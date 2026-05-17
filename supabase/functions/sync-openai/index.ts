// Sync usage and cost data from OpenAI's organization Usage API.
//
// OpenAI Usage API (admin keys):
//   GET https://api.openai.com/v1/organization/usage/completions
//     ?start_time=<unix> &end_time=<unix> &bucket_width=1d|1h
//   GET https://api.openai.com/v1/organization/costs
//     ?start_time=<unix> &end_time=<unix> &bucket_width=1d
//   Headers: Authorization: Bearer <admin-key>
//
// We pull both endpoints — usage for token counts, costs for the authoritative
// dollar figure (which already accounts for promo credits, tiered pricing, etc.).
// We then merge into a single activity_rows record per (bucket × model).
//
// Body: { credential_id: string, start_time?: ISO, end_time?: ISO, bucket_width?: '1d'|'1h' }
// Without start_time, defaults to 30 days back.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_USAGE_URL = "https://api.openai.com/v1/organization/usage/completions";
const OPENAI_COSTS_URL = "https://api.openai.com/v1/organization/costs";
const PROVIDER_SOURCE = "openai";

// Fallback prices per million tokens (USD). Used only when /costs is empty
// (e.g. partial day that hasn't been billed yet). Update periodically.
const OPENAI_PRICING_USD_PER_M: Record<string, { input: number; output: number; cached: number }> = {
  "gpt-4.1": { input: 2.5, output: 10, cached: 1.25 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6, cached: 0.2 },
  "gpt-4o": { input: 2.5, output: 10, cached: 1.25 },
  "gpt-4o-mini": { input: 0.15, output: 0.6, cached: 0.075 },
  "o4-mini": { input: 1.1, output: 4.4, cached: 0.275 },
  "o3": { input: 2, output: 8, cached: 0.5 },
  "gpt-5": { input: 10, output: 40, cached: 5 },
};

function priceFor(model: string) {
  const lower = model.toLowerCase();
  for (const [prefix, price] of Object.entries(OPENAI_PRICING_USD_PER_M)) {
    if (lower.includes(prefix)) return price;
  }
  return { input: 2.5, output: 10, cached: 1.25 };
}

interface OpenAIBucket {
  start_time: number;
  end_time: number;
  results?: Array<{
    object?: string;
    input_tokens?: number;
    output_tokens?: number;
    input_cached_tokens?: number;
    num_model_requests?: number;
    model?: string;
    project_id?: string;
    user_id?: string;
    api_key_id?: string;
    batch?: boolean;
    amount?: { value: number; currency: string };
    line_item?: string;
  }>;
}

async function fetchAllPages(
  baseUrl: string,
  apiKey: string,
  params: URLSearchParams,
): Promise<OpenAIBucket[]> {
  const buckets: OpenAIBucket[] = [];
  let page: string | null = null;
  for (let i = 0; i < 30; i++) {
    if (page) params.set("page", page);
    const res = await fetch(`${baseUrl}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API ${res.status}: ${errText.slice(0, 400)}`);
    }
    const json = await res.json();
    if (Array.isArray(json.data)) buckets.push(...json.data);
    if (json.has_more && json.next_page) page = json.next_page;
    else break;
  }
  return buckets;
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
    const endTime = body.end_time ? new Date(body.end_time) : new Date();
    const startTime = body.start_time
      ? new Date(body.start_time)
      : new Date(endTime.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (!credentialId) {
      return new Response(JSON.stringify({ error: "credential_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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
    if (cred.provider !== "openai") {
      return new Response(JSON.stringify({ error: "Wrong provider for sync-openai" }), {
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

    const startUnix = Math.floor(startTime.getTime() / 1000);
    const endUnix = Math.floor(endTime.getTime() / 1000);

    const usageParams = new URLSearchParams({
      start_time: String(startUnix),
      end_time: String(endUnix),
      bucket_width: bucketWidth,
      "group_by[]": "model",
    });
    const usageBuckets = await fetchAllPages(OPENAI_USAGE_URL, cred.api_key, usageParams).catch((e) => {
      throw e;
    });

    // Costs API only supports 1d buckets — pull regardless of bucket_width to enrich.
    const costsParams = new URLSearchParams({
      start_time: String(startUnix),
      end_time: String(endUnix),
      bucket_width: "1d",
      "group_by[]": "line_item",
    });
    const costsBuckets = await fetchAllPages(OPENAI_COSTS_URL, cred.api_key, costsParams).catch(() => []);

    // Index costs: Map<dayStart, Map<model, costUsd>>
    const costsIndex = new Map<number, Map<string, number>>();
    for (const bucket of costsBuckets) {
      const dayStart = bucket.start_time;
      const dayMap = costsIndex.get(dayStart) ?? new Map<string, number>();
      for (const r of bucket.results ?? []) {
        // line_item often looks like "GPT-4o input tokens"; we extract the model prefix
        const li = (r.line_item ?? "").toLowerCase();
        const modelKey = li.split(" ")[0] ?? "unknown";
        const value = r.amount?.value ?? 0;
        dayMap.set(modelKey, (dayMap.get(modelKey) ?? 0) + value);
      }
      costsIndex.set(dayStart, dayMap);
    }

    let inserted = 0;
    let totalCostUsd = 0;

    for (const bucket of usageBuckets) {
      const startIso = new Date(bucket.start_time * 1000).toISOString();
      const dayStart = bucket.start_time - (bucket.start_time % 86400);

      for (const r of bucket.results ?? []) {
        const model = r.model ?? "unknown";
        const inputTok = r.input_tokens ?? 0;
        const outputTok = r.output_tokens ?? 0;
        const cachedTok = r.input_cached_tokens ?? 0;
        const requestCount = r.num_model_requests ?? 1;

        // Try costs API first (authoritative). Fall back to fallback pricing.
        const dayCosts = costsIndex.get(dayStart);
        const lower = model.toLowerCase();
        let cost = 0;
        let costSource = "fallback";
        if (dayCosts) {
          for (const [k, v] of dayCosts) {
            if (lower.includes(k)) {
              cost += v;
              costSource = "openai_costs_api";
            }
          }
        }
        if (cost === 0) {
          const price = priceFor(model);
          cost = (inputTok * price.input + outputTok * price.output + cachedTok * price.cached) / 1_000_000;
        }
        totalCostUsd += cost;

        const generationId = `openai::${bucket.start_time}::${model}::${r.project_id ?? "main"}::${r.api_key_id ?? "any"}`;

        const { error } = await svc.from("activity_rows").upsert({
          generation_id: generationId,
          created_at: startIso,
          cost_total: cost,
          cost_web_search: 0,
          cost_cache: 0,
          cost_file_processing: 0,
          byok_usage_inference: 0,
          tokens_prompt: inputTok,
          tokens_completion: outputTok,
          tokens_reasoning: 0,
          tokens_cached: cachedTok,
          model_permaslug: `openai/${model}`,
          provider_name: "OpenAI",
          variant: r.batch ? "batch" : "",
          cancelled: false,
          streamed: false,
          user: "",
          finish_reason_raw: "",
          finish_reason_normalized: "",
          generation_time_ms: 0,
          time_to_first_token_ms: 0,
          app_name: `openai-admin-sync (${costSource})`,
          api_key_name: r.api_key_id ?? "",
          user_id: userRes.user.id,
          provider_source: PROVIDER_SOURCE,
          request_count: requestCount,
        }, { onConflict: "generation_id" });

        if (!error) inserted++;
        else console.error("upsert error", error);
      }
    }

    await svc.from("provider_credentials").update({
      last_sync_status: "ok",
      last_sync_error: null,
      last_synced_at: new Date().toISOString(),
      rows_imported: inserted,
    }).eq("id", credentialId);

    return new Response(
      JSON.stringify({
        success: true,
        provider: "openai",
        inserted,
        total_cost_usd: Number(totalCostUsd.toFixed(4)),
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("sync-openai error", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
