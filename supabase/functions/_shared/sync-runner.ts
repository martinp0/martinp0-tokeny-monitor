// Provider sync implementations. Used by the per-provider HTTP functions (manual "Sync" in the
// UI, authenticated as the user) and by the `auto-sync` cron function (service role).
//
// Every row is written with the credential owner's user_id and upserted on
// (user_id, generation_id), so one user's sync can never overwrite another user's rows.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  ACTIVITY_CONFLICT_TARGET,
  type ActivityRowInsert,
  type AnthropicUsageBucket,
  collectPages,
  isSupportedSyncProvider,
  mapAnthropicBuckets,
  mapOpenRouterItem,
  openAIGenerationId,
  type OpenRouterActivityItem,
  type SyncProvider,
  upsertInBatches,
} from "./sync-core.ts";

export interface Credential {
  id: string;
  user_id: string;
  provider: string;
  api_key: string;
  enabled: boolean;
  last_synced_at?: string | null;
}

export interface SyncOptions {
  /** ISO start of the window (Anthropic/OpenAI). Defaults to 30 days back. */
  start?: Date;
  end?: Date;
  bucketWidth?: "1d" | "1h";
}

export interface SyncOutcome {
  ok: boolean;
  provider: SyncProvider;
  fetched: number;
  inserted: number;
  failed: number;
  error?: string;
  status: number;
}

class ProviderError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

const DAY = 86_400_000;

async function fetchJson(url: string, headers: Record<string, string>): Promise<any> {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = (await res.text()).slice(0, 400);
    // Upstream 401/403 → the user's key is wrong or lacks permission: surface as 400, not 5xx.
    const status = res.status === 401 || res.status === 403 ? 400 : 502;
    throw new ProviderError(`${new URL(url).hostname} ${res.status}: ${text}`, status);
  }
  return res.json();
}

// ───────────── OpenRouter (Management key) ─────────────
async function openRouterRows(cred: Credential): Promise<ActivityRowInsert[]> {
  const payload = await fetchJson("https://openrouter.ai/api/v1/activity", {
    Authorization: `Bearer ${cred.api_key}`,
  });
  const items: OpenRouterActivityItem[] = Array.isArray(payload?.data) ? payload.data : [];
  return items.map((i) => mapOpenRouterItem(i, cred.user_id)).filter((r): r is ActivityRowInsert => r !== null);
}

// ───────────── Anthropic (Admin key) ─────────────
async function anthropicRows(cred: Credential, opts: Required<SyncOptions>): Promise<ActivityRowInsert[]> {
  const pages = await collectPages(async (cursor) => {
    const params = new URLSearchParams({
      starting_at: opts.start.toISOString(),
      ending_at: opts.end.toISOString(),
      bucket_width: opts.bucketWidth,
      limit: opts.bucketWidth === "1d" ? "31" : "168",
    });
    for (const g of ["model", "service_tier", "workspace_id"]) params.append("group_by[]", g);
    if (cursor) params.set("page", cursor);
    return await fetchJson(`https://api.anthropic.com/v1/organizations/usage_report/messages?${params}`, {
      "x-api-key": cred.api_key,
      "anthropic-version": "2023-06-01",
    });
  });
  const buckets: AnthropicUsageBucket[] = pages.flatMap((p: any) => p?.data ?? []);
  return mapAnthropicBuckets(buckets, cred.user_id);
}

// ───────────── OpenAI (Admin key) ─────────────
const OPENAI_PRICING_USD_PER_M: Record<string, { input: number; output: number; cached: number }> = {
  "gpt-4.1-nano": { input: 0.1, output: 0.4, cached: 0.025 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6, cached: 0.1 },
  "gpt-4.1": { input: 2, output: 8, cached: 0.5 },
  "gpt-4o-mini": { input: 0.15, output: 0.6, cached: 0.075 },
  "gpt-4o": { input: 2.5, output: 10, cached: 1.25 },
  "o4-mini": { input: 1.1, output: 4.4, cached: 0.275 },
  "o3": { input: 2, output: 8, cached: 0.5 },
  "gpt-5-nano": { input: 0.05, output: 0.4, cached: 0.005 },
  "gpt-5-mini": { input: 0.25, output: 2, cached: 0.025 },
  "gpt-5": { input: 1.25, output: 10, cached: 0.125 },
};

function longestKeyMatch<T>(model: string, table: Map<string, T> | Record<string, T>): T | undefined {
  const lower = model.toLowerCase();
  const entries = table instanceof Map ? [...table.entries()] : Object.entries(table);
  let best: [string, T] | undefined;
  for (const [k, v] of entries) if (k && lower.includes(k) && (!best || k.length > best[0].length)) best = [k, v];
  return best?.[1];
}

async function openAIRows(cred: Credential, opts: Required<SyncOptions>): Promise<ActivityRowInsert[]> {
  const startUnix = Math.floor(opts.start.getTime() / 1000);
  const endUnix = Math.floor(opts.end.getTime() / 1000);
  const headers = { Authorization: `Bearer ${cred.api_key}` };

  const drain = (base: string, params: URLSearchParams) =>
    collectPages(async (cursor) => {
      const p = new URLSearchParams(params);
      if (cursor) p.set("page", cursor);
      return await fetchJson(`${base}?${p}`, headers);
    }, 30).then((pages) => pages.flatMap((p: any) => (Array.isArray(p?.data) ? p.data : [])));

  const usageParams = new URLSearchParams({
    start_time: String(startUnix),
    end_time: String(endUnix),
    bucket_width: opts.bucketWidth,
    limit: opts.bucketWidth === "1d" ? "31" : "168",
  });
  usageParams.append("group_by[]", "model");
  const usageBuckets = await drain("https://api.openai.com/v1/organization/usage/completions", usageParams);

  // Authoritative $ from the Costs API (1d buckets only). Only used for daily usage buckets,
  // otherwise each hour would be assigned the whole day's cost.
  const costsIndex = new Map<number, Map<string, number>>();
  if (opts.bucketWidth === "1d") {
    const costsParams = new URLSearchParams({
      start_time: String(startUnix),
      end_time: String(endUnix),
      bucket_width: "1d",
      limit: "180",
    });
    costsParams.append("group_by[]", "line_item");
    const costBuckets = await drain("https://api.openai.com/v1/organization/costs", costsParams).catch((e) => {
      console.warn("openai costs api unavailable, using list prices", e instanceof Error ? e.message : e);
      return [] as any[];
    });
    for (const b of costBuckets) {
      const day = Number(b.start_time) - (Number(b.start_time) % 86400);
      const m = costsIndex.get(day) ?? new Map<string, number>();
      for (const r of b.results ?? []) {
        const key = String(r.line_item ?? "").toLowerCase().split(" ")[0] ?? "";
        if (!key) continue;
        m.set(key, (m.get(key) ?? 0) + Number(r.amount?.value ?? 0));
      }
      costsIndex.set(day, m);
    }
  }

  const rows: ActivityRowInsert[] = [];
  for (const b of usageBuckets) {
    const start = Number(b.start_time);
    const day = start - (start % 86400);
    for (const r of b.results ?? []) {
      const model = r.model ?? "unknown";
      const input = Number(r.input_tokens ?? 0);
      const output = Number(r.output_tokens ?? 0);
      const cached = Number(r.input_cached_tokens ?? 0);
      if (input + output === 0) continue;
      const dayCosts = costsIndex.get(day);
      let cost = dayCosts ? longestKeyMatch(model, dayCosts) ?? 0 : 0;
      let source = cost > 0 ? "openai_costs_api" : "list_price_estimate";
      if (cost === 0) {
        const p = longestKeyMatch(model, OPENAI_PRICING_USD_PER_M) ?? { input: 2.5, output: 10, cached: 1.25 };
        cost = ((input - cached) * p.input + cached * p.cached + output * p.output) / 1_000_000;
        source = "list_price_estimate";
      }
      rows.push({
        generation_id: openAIGenerationId(start, r),
        user_id: cred.user_id,
        created_at: new Date(start * 1000).toISOString(),
        cost_total: Math.max(0, cost),
        tokens_prompt: input,
        tokens_completion: output,
        tokens_reasoning: 0,
        tokens_cached: cached,
        model_permaslug: `openai/${model}`,
        provider_name: "OpenAI",
        variant: r.batch ? "batch" : "",
        app_name: `openai-admin-sync (${source})`,
        api_key_name: r.api_key_id ?? "",
        provider_source: "openai",
        request_count: Math.max(1, Number(r.num_model_requests ?? 1)),
      });
    }
  }
  return rows;
}

/** Run one credential's sync end-to-end and record the result on the credential row. */
export async function runCredentialSync(
  svc: SupabaseClient,
  cred: Credential,
  options: SyncOptions = {},
): Promise<SyncOutcome> {
  const provider = cred.provider;
  if (!isSupportedSyncProvider(provider)) {
    return { ok: false, provider: provider as SyncProvider, fetched: 0, inserted: 0, failed: 0, status: 400, error: "Unsupported provider" };
  }
  const end = options.end ?? new Date();
  const opts: Required<SyncOptions> = {
    end,
    start: options.start ?? new Date(end.getTime() - 30 * DAY),
    bucketWidth: options.bucketWidth ?? "1d",
  };

  await svc.from("provider_credentials").update({
    last_sync_status: "running",
    last_sync_error: null,
    last_sync_attempt_at: new Date().toISOString(),
  }).eq("id", cred.id);

  try {
    const rows = provider === "openrouter"
      ? await openRouterRows(cred)
      : provider === "anthropic"
      ? await anthropicRows(cred, opts)
      : await openAIRows(cred, opts);

    const res = await upsertInBatches(rows, (batch) =>
      svc.from("activity_rows").upsert(batch, { onConflict: ACTIVITY_CONFLICT_TARGET })
    );
    const ok = res.failed === 0;
    const error = ok ? undefined : `Uložení ${res.failed} z ${rows.length} řádků selhalo: ${res.errors[0] ?? "unknown"}`;
    await svc.from("provider_credentials").update({
      last_sync_status: ok ? "ok" : "error",
      last_sync_error: error ?? null,
      last_synced_at: new Date().toISOString(),
      rows_imported: res.upserted,
    }).eq("id", cred.id);
    if (!ok) console.error(`sync ${provider} upsert errors`, res.errors);
    return { ok, provider, fetched: rows.length, inserted: res.upserted, failed: res.failed, error, status: ok ? 200 : 500 };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const status = e instanceof ProviderError ? e.status : 500;
    await svc.from("provider_credentials").update({
      last_sync_status: "error",
      last_sync_error: message.slice(0, 500),
    }).eq("id", cred.id);
    console.error(`sync ${provider} failed`, message);
    return { ok: false, provider, fetched: 0, inserted: 0, failed: 0, error: message, status };
  }
}
