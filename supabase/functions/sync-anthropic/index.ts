// Sync usage data from Anthropic's Admin API.
//
// Anthropic Admin API (admin keys, sk-ant-admin01-...):
//   GET https://api.anthropic.com/v1/organizations/usage_report/messages
//     ?starting_at=ISO8601 & ending_at=ISO8601 & bucket_width=1d|1h
//   Headers:
//     x-api-key: <admin-key>
//     anthropic-version: 2023-06-01
//
// Response (paginated): time-bucketed aggregates with input/output/cache token counts
// per (model, service_tier, workspace, ...). We collapse one entry per (bucket × model)
// and store it as a single activity_rows record with request_count = N requests in bucket.
//
// Body: { credential_id: string, starting_at?: string, ending_at?: string, bucket_width?: '1d'|'1h' }
// Without starting_at, defaults to 30 days back.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_USAGE_URL = "https://api.anthropic.com/v1/organizations/usage_report/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const PROVIDER_SOURCE = "anthropic";

// Anthropic published prices per million tokens (USD). Used as fallback when the
// Usage API does not return cost data. Update periodically.
// https://www.anthropic.com/pricing#anthropic-api
const ANTHROPIC_PRICING_USD_PER_M: Record<string, { input: number; output: number; cache_write: number; cache_read: number }> = {
  // Claude 4.6 family (May 2026 pricing)
  "claude-opus-4-6": { input: 15, output: 75, cache_write: 18.75, cache_read: 1.5 },
  "claude-sonnet-4-6": { input: 3, output: 15, cache_write: 3.75, cache_read: 0.3 },
  "claude-haiku-4-5": { input: 1, output: 5, cache_write: 1.25, cache_read: 0.1 },
  // Older models still in service
  "claude-3-5-sonnet": { input: 3, output: 15, cache_write: 3.75, cache_read: 0.3 },
  "claude-3-5-haiku": { input: 0.8, output: 4, cache_write: 1, cache_read: 0.08 },
  "claude-3-opus": { input: 15, output: 75, cache_write: 18.75, cache_read: 1.5 },
};

function priceFor(model: string) {
  const lower = model.toLowerCase();
  for (const [prefix, price] of Object.entries(ANTHROPIC_PRICING_USD_PER_M)) {
    if (lower.includes(prefix)) return price;
  }
  // Conservative default — log so we add the model later.
  return { input: 3, output: 15, cache_write: 3.75, cache_read: 0.3 };
}

interface UsageBucket {
  starts_at: string;
  ends_at?: string;
  results?: Array<{
    model?: string;
    service_tier?: string;
    workspace_id?: string;
    uncached_input_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    output_tokens?: number;
    server_tool_use?: Record<string, number>;
    request_count?: number;
  }>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const credentialId = String(body.credential_id ?? "");
    const bucketWidth = (body.bucket_width === "1h" ? "1h" : "1d") as "1d" | "1h";
    const endingAt = body.ending_at ? new Date(body.ending_at) : new Date();
    const startingAt = body.starting_at
      ? new Date(body.starting_at)
      : new Date(endingAt.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (!credentialId) {
      return new Response(JSON.stringify({ error: "credential_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load credential — must belong to current user and be enabled.
    const { data: cred, error: credErr } = await svc
      .from("provider_credentials")
      .select("id, user_id, provider, api_key, enabled")
      .eq("id", credentialId)
      .eq("user_id", userRes.user.id)
      .single();

    if (credErr || !cred) {
      return new Response(JSON.stringify({ error: "Credential not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (cred.provider !== "anthropic") {
      return new Response(JSON.stringify({ error: "Wrong provider for sync-anthropic" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!cred.enabled) {
      return new Response(JSON.stringify({ error: "Credential is disabled" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await svc.from("provider_credentials").update({
      last_sync_status: "running",
      last_sync_error: null,
    }).eq("id", credentialId);

    let inserted = 0;
    let totalCostUsd = 0;
    let pageCursor: string | null = null;

    do {
      const params = new URLSearchParams({
        starting_at: startingAt.toISOString(),
        ending_at: endingAt.toISOString(),
        bucket_width: bucketWidth,
        // Group by model + service_tier so we get one row per (bucket × model).
        "group_by[]": "model",
      });
      if (pageCursor) params.set("page", pageCursor);

      const apiRes = await fetch(`${ANTHROPIC_USAGE_URL}?${params.toString()}`, {
        headers: {
          "x-api-key": cred.api_key,
          "anthropic-version": ANTHROPIC_VERSION,
        },
      });

      if (!apiRes.ok) {
        const errText = await apiRes.text();
        await svc.from("provider_credentials").update({
          last_sync_status: "error",
          last_sync_error: `Anthropic API ${apiRes.status}: ${errText.slice(0, 400)}`,
        }).eq("id", credentialId);
        return new Response(
          JSON.stringify({ error: `Anthropic API ${apiRes.status}: ${errText}` }),
          { status: apiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const payload = await apiRes.json();
      const buckets: UsageBucket[] = payload.data ?? payload.buckets ?? [];

      for (const bucket of buckets) {
        const bucketStart = bucket.starts_at;
        for (const r of bucket.results ?? []) {
          const model = r.model ?? "unknown";
          const inputTok = r.uncached_input_tokens ?? 0;
          const outputTok = r.output_tokens ?? 0;
          const cacheWriteTok = r.cache_creation_input_tokens ?? 0;
          const cacheReadTok = r.cache_read_input_tokens ?? 0;
          const requestCount = r.request_count ?? 1;

          const price = priceFor(model);
          const cost =
            (inputTok * price.input +
              outputTok * price.output +
              cacheWriteTok * price.cache_write +
              cacheReadTok * price.cache_read) /
            1_000_000;

          totalCostUsd += cost;

          const generationId = `anthropic::${bucketStart}::${model}::${r.service_tier ?? "default"}::${r.workspace_id ?? "main"}`;

          const { error } = await svc.from("activity_rows").upsert({
            generation_id: generationId,
            created_at: bucketStart,
            cost_total: cost,
            cost_web_search: 0,
            cost_cache: (cacheWriteTok * price.cache_write + cacheReadTok * price.cache_read) / 1_000_000,
            cost_file_processing: 0,
            byok_usage_inference: 0,
            tokens_prompt: inputTok,
            tokens_completion: outputTok,
            tokens_reasoning: 0,
            tokens_cached: cacheReadTok,
            model_permaslug: `anthropic/${model}`,
            provider_name: "Anthropic",
            variant: r.service_tier ?? "",
            cancelled: false,
            streamed: false,
            user: "",
            finish_reason_raw: "",
            finish_reason_normalized: "",
            generation_time_ms: 0,
            time_to_first_token_ms: 0,
            app_name: "anthropic-admin-sync",
            api_key_name: "",
            user_id: userRes.user.id,
            provider_source: PROVIDER_SOURCE,
            request_count: requestCount,
          }, { onConflict: "generation_id" });

          if (!error) inserted++;
          else console.error("upsert error", error);
        }
      }

      pageCursor = payload.next_page ?? payload.has_more ? payload.next_cursor ?? null : null;
    } while (pageCursor);

    await svc.from("provider_credentials").update({
      last_sync_status: "ok",
      last_sync_error: null,
      last_synced_at: new Date().toISOString(),
      rows_imported: inserted,
    }).eq("id", credentialId);

    return new Response(
      JSON.stringify({
        success: true,
        provider: "anthropic",
        inserted,
        total_cost_usd: Number(totalCostUsd.toFixed(4)),
        starting_at: startingAt.toISOString(),
        ending_at: endingAt.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("sync-anthropic error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
