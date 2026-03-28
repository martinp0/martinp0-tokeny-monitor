import Papa from "papaparse";

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
}

const toNum = (v: string | undefined) => {
  if (!v || v === "") return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

export function parseCSV(text: string): ActivityRow[] {
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
  });

  return (result.data as Record<string, string>[]).map((row) => ({
    generation_id: row.generation_id || "",
    created_at: row.created_at || "",
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
  }));
}
