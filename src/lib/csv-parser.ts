import Papa from "papaparse";

export type ProviderSource = "openrouter" | "anthropic" | "openai";

export interface ActivityRow {
  generation_id: string;
  created_at: string;
  cost_total: number;
  cost_web_search: number;
  cost_cache: number;
  cost_file_processing: number;
  byok_usage_inference: number;
  tokens_prompt: number;
  tokens_completion: number;
  tokens_reasoning: number;
  tokens_cached: number;
  model_permaslug: string;
  provider_name: string;
  variant: string;
  cancelled: boolean;
  streamed: boolean;
  user: string;
  finish_reason_raw: string;
  finish_reason_normalized: string;
  generation_time_ms: number;
  time_to_first_token_ms: number;
  app_name: string;
  api_key_name: string;
  provider_source: ProviderSource;
  request_count: number;
}

const toNum = (v: string | undefined) => {
  if (!v || v === "") return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

/**
 * Parse an OpenRouter activity CSV export.
 *
 * Rows without generation_id or created_at are dropped (they cannot be stored: generation_id is
 * part of the unique key). Duplicate generation_ids within one file are collapsed (last wins),
 * because a single upsert statement must not hit the same conflict key twice.
 */
export function parseCSV(text: string): ActivityRow[] {
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const rows = (result.data as Record<string, string>[])
    .filter((row) => (row.generation_id ?? "").trim() !== "" && (row.created_at ?? "").trim() !== "")
    .map((row) => mapRow(row));

  const byId = new Map<string, ActivityRow>();
  for (const r of rows) byId.set(r.generation_id, r);
  return byId.size === rows.length ? rows : [...byId.values()];
}

function mapRow(row: Record<string, string>): ActivityRow {
  return {
    generation_id: row.generation_id.trim(),
    created_at: row.created_at.trim(),
    cost_total: toNum(row.cost_total),
    cost_web_search: toNum(row.cost_web_search),
    cost_cache: toNum(row.cost_cache),
    cost_file_processing: toNum(row.cost_file_processing),
    byok_usage_inference: toNum(row.byok_usage_inference),
    tokens_prompt: toNum(row.tokens_prompt),
    tokens_completion: toNum(row.tokens_completion),
    tokens_reasoning: toNum(row.tokens_reasoning),
    tokens_cached: toNum(row.tokens_cached),
    model_permaslug: row.model_permaslug || "",
    provider_name: row.provider_name || "",
    variant: row.variant || "",
    cancelled: row.cancelled === "true",
    streamed: row.streamed === "true",
    user: row.user || "",
    finish_reason_raw: row.finish_reason_raw || "",
    finish_reason_normalized: row.finish_reason_normalized || "",
    generation_time_ms: toNum(row.generation_time_ms),
    time_to_first_token_ms: toNum(row.time_to_first_token_ms),
    app_name: row.app_name || "",
    api_key_name: row.api_key_name || "",
    provider_source: "openrouter",
    request_count: 1,
  };
}
