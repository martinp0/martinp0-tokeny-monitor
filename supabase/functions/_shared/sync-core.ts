// Pure, runtime-agnostic sync helpers shared by the provider sync edge functions.
//
// No Deno globals and no URL imports here: this file is imported both by the Deno edge
// functions and by the Vitest suite (src/test/sync-core.test.ts).

export const SUPPORTED_SYNC_PROVIDERS = ["openrouter", "anthropic", "openai"] as const;
export type SyncProvider = (typeof SUPPORTED_SYNC_PROVIDERS)[number];

export function isSupportedSyncProvider(p: unknown): p is SyncProvider {
  return typeof p === "string" && (SUPPORTED_SYNC_PROVIDERS as readonly string[]).includes(p);
}

/** Conflict target for every activity_rows upsert. generation_id is unique per user, not globally. */
export const ACTIVITY_CONFLICT_TARGET = "user_id,generation_id";

/** Row shape written to public.activity_rows by sync jobs. */
export interface ActivityRowInsert {
  generation_id: string;
  user_id: string;
  created_at: string;
  cost_total: number;
  cost_web_search?: number;
  cost_cache?: number;
  cost_file_processing?: number;
  byok_usage_inference?: number;
  tokens_prompt: number;
  tokens_completion: number;
  tokens_reasoning: number;
  tokens_cached: number;
  model_permaslug: string;
  provider_name: string;
  variant?: string;
  app_name?: string;
  api_key_name?: string;
  generation_time_ms?: number;
  time_to_first_token_ms?: number;
  provider_source: SyncProvider;
  request_count: number;
}

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

// ───────────────────────────── OpenRouter ─────────────────────────────
// GET https://openrouter.ai/api/v1/activity (Management key required). Returns one item per
// (UTC day × model permaslug × endpoint) for the last 30 completed UTC days.

export interface OpenRouterActivityItem {
  date?: string;
  model?: string;
  model_permaslug?: string;
  endpoint_id?: string;
  provider_name?: string;
  usage?: number;
  byok_usage_inference?: number;
  requests?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  reasoning_tokens?: number;
  cached_tokens?: number;
}

/** Stable id; format kept identical to the previous implementation so re-syncs update existing rows. */
export function openRouterGenerationId(item: OpenRouterActivityItem): string {
  return `${item.date ?? ""}_${item.model_permaslug ?? ""}_${item.endpoint_id ?? ""}`;
}

export function mapOpenRouterItem(item: OpenRouterActivityItem, userId: string): ActivityRowInsert | null {
  if (!item?.date) return null;
  return {
    generation_id: openRouterGenerationId(item),
    user_id: userId,
    created_at: item.date,
    cost_total: num(item.usage),
    byok_usage_inference: num(item.byok_usage_inference),
    tokens_prompt: Math.round(num(item.prompt_tokens)),
    tokens_completion: Math.round(num(item.completion_tokens)),
    tokens_reasoning: Math.round(num(item.reasoning_tokens)),
    tokens_cached: Math.round(num(item.cached_tokens)),
    model_permaslug: item.model_permaslug || item.model || "",
    provider_name: item.provider_name || "",
    app_name: "openrouter-activity-sync",
    provider_source: "openrouter",
    request_count: Math.max(1, Math.round(num(item.requests)) || 1),
  };
}

// ───────────────────────────── Anthropic ─────────────────────────────
// GET https://api.anthropic.com/v1/organizations/usage_report/messages (Admin key).
// Buckets carry `starting_at` / `ending_at`; pagination via `has_more` + `next_page`.

export interface AnthropicUsageResult {
  model?: string | null;
  service_tier?: string | null;
  workspace_id?: string | null;
  uncached_input_tokens?: number;
  cache_creation?: { ephemeral_1h_input_tokens?: number; ephemeral_5m_input_tokens?: number };
  /** Older response shape. */
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  output_tokens?: number;
  server_tool_use?: { web_search_requests?: number };
}

export interface AnthropicUsageBucket {
  starting_at?: string;
  /** Some older docs/clients used starts_at; accept both. */
  starts_at?: string;
  ending_at?: string;
  results?: AnthropicUsageResult[];
}

export interface PagedResponse {
  has_more?: boolean;
  next_page?: string | null;
}

/**
 * Cursor for the next page, or null when done. Fixes the previous
 * `payload.next_page ?? payload.has_more ? payload.next_cursor ?? null : null` precedence bug,
 * which parsed as `(next_page ?? has_more) ? next_cursor : null` and always stopped after page 1
 * because `next_cursor` does not exist in the API.
 */
export function nextPageCursor(payload: PagedResponse | null | undefined): string | null {
  if (!payload || !payload.has_more) return null;
  return typeof payload.next_page === "string" && payload.next_page.length > 0 ? payload.next_page : null;
}

/**
 * Drain a cursor-paginated API. `fetchPage(cursor)` returns the page payload; stops when
 * `nextPageCursor` is null, the same cursor repeats, or `maxPages` is reached.
 */
export async function collectPages<T extends PagedResponse>(
  fetchPage: (cursor: string | null) => Promise<T>,
  maxPages = 50,
): Promise<T[]> {
  const pages: T[] = [];
  let cursor: string | null = null;
  const seen = new Set<string>();
  for (let i = 0; i < maxPages; i++) {
    const page = await fetchPage(cursor);
    pages.push(page);
    const next = nextPageCursor(page);
    if (!next || seen.has(next)) break;
    seen.add(next);
    cursor = next;
  }
  return pages;
}

// Anthropic list prices, USD per million tokens. The usage report has no cost data, so cost is
// an estimate. Longest prefix wins. Update periodically: https://www.anthropic.com/pricing#api
export const ANTHROPIC_PRICING_USD_PER_M: Record<string, { input: number; output: number; cache_write: number; cache_read: number }> = {
  // Opus 4 / 4.1 kept the old $15/$75 pricing; Opus 4.5+ dropped to $5/$25.
  "claude-opus-4-2025": { input: 15, output: 75, cache_write: 18.75, cache_read: 1.5 },
  "claude-opus-4-1": { input: 15, output: 75, cache_write: 18.75, cache_read: 1.5 },
  "claude-opus-4": { input: 5, output: 25, cache_write: 6.25, cache_read: 0.5 },
  "claude-sonnet-4": { input: 3, output: 15, cache_write: 3.75, cache_read: 0.3 },
  "claude-haiku-4": { input: 1, output: 5, cache_write: 1.25, cache_read: 0.1 },
  "claude-3-7-sonnet": { input: 3, output: 15, cache_write: 3.75, cache_read: 0.3 },
  "claude-3-5-sonnet": { input: 3, output: 15, cache_write: 3.75, cache_read: 0.3 },
  "claude-3-5-haiku": { input: 0.8, output: 4, cache_write: 1, cache_read: 0.08 },
  "claude-3-opus": { input: 15, output: 75, cache_write: 18.75, cache_read: 1.5 },
  "claude-3-haiku": { input: 0.25, output: 1.25, cache_write: 0.3, cache_read: 0.03 },
};
const ANTHROPIC_DEFAULT_PRICE = { input: 3, output: 15, cache_write: 3.75, cache_read: 0.3 };

export function anthropicPriceFor(model: string) {
  const lower = model.toLowerCase();
  let best: string | null = null;
  for (const prefix of Object.keys(ANTHROPIC_PRICING_USD_PER_M)) {
    if (lower.includes(prefix) && (!best || prefix.length > best.length)) best = prefix;
  }
  return best ? ANTHROPIC_PRICING_USD_PER_M[best] : ANTHROPIC_DEFAULT_PRICE;
}

export function anthropicGenerationId(bucketStart: string, r: AnthropicUsageResult): string {
  return `anthropic::${bucketStart}::${r.model ?? "unknown"}::${r.service_tier ?? "default"}::${r.workspace_id ?? "main"}`;
}

export function mapAnthropicBuckets(buckets: AnthropicUsageBucket[], userId: string): ActivityRowInsert[] {
  const rows: ActivityRowInsert[] = [];
  for (const bucket of buckets ?? []) {
    const start = bucket.starting_at ?? bucket.starts_at;
    if (!start) continue;
    for (const r of bucket.results ?? []) {
      const model = r.model ?? "unknown";
      const input = num(r.uncached_input_tokens);
      const output = num(r.output_tokens);
      const cacheWrite = r.cache_creation
        ? num(r.cache_creation.ephemeral_1h_input_tokens) + num(r.cache_creation.ephemeral_5m_input_tokens)
        : num(r.cache_creation_input_tokens);
      const cacheRead = num(r.cache_read_input_tokens);
      if (input + output + cacheWrite + cacheRead === 0) continue;
      const p = anthropicPriceFor(model);
      const cacheCost = (cacheWrite * p.cache_write + cacheRead * p.cache_read) / 1_000_000;
      const cost = (input * p.input + output * p.output) / 1_000_000 + cacheCost;
      rows.push({
        generation_id: anthropicGenerationId(start, r),
        user_id: userId,
        created_at: start,
        cost_total: cost,
        cost_cache: cacheCost,
        tokens_prompt: input + cacheWrite + cacheRead,
        tokens_completion: output,
        tokens_reasoning: 0,
        tokens_cached: cacheRead,
        model_permaslug: `anthropic/${model}`,
        provider_name: "Anthropic",
        variant: r.service_tier ?? "",
        app_name: "anthropic-admin-sync (estimated cost)",
        provider_source: "anthropic",
        // The usage report does not expose request counts; one bucket row counts as 1.
        request_count: 1,
      });
    }
  }
  return rows;
}

// ───────────────────────────── OpenAI ─────────────────────────────

export function openAIGenerationId(bucketStartUnix: number, r: { model?: string | null; project_id?: string | null; api_key_id?: string | null }): string {
  return `openai::${bucketStartUnix}::${r.model ?? "unknown"}::${r.project_id ?? "main"}::${r.api_key_id ?? "any"}`;
}

// ───────────────────────────── Upsert helpers ─────────────────────────────

/** De-duplicate by generation_id (last one wins). Postgres rejects an upsert batch that hits the same key twice. */
export function dedupeByGenerationId<T extends { generation_id: string }>(rows: T[]): T[] {
  const map = new Map<string, T>();
  for (const r of rows) if (r.generation_id) map.set(r.generation_id, r);
  return [...map.values()];
}

export function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) throw new Error("chunk size must be > 0");
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export interface UpsertResult {
  upserted: number;
  failed: number;
  errors: string[];
}

type UpsertFn = (
  rows: ActivityRowInsert[],
) => PromiseLike<{ error: { message: string } | null }>;

/** Batch-upsert rows, collecting (not swallowing) errors so callers can surface them. */
export async function upsertInBatches(rows: ActivityRowInsert[], upsert: UpsertFn, batchSize = 500): Promise<UpsertResult> {
  const result: UpsertResult = { upserted: 0, failed: 0, errors: [] };
  for (const batch of chunk(dedupeByGenerationId(rows), batchSize)) {
    const { error } = await upsert(batch);
    if (error) {
      result.failed += batch.length;
      if (result.errors.length < 5) result.errors.push(error.message);
    } else {
      result.upserted += batch.length;
    }
  }
  return result;
}
