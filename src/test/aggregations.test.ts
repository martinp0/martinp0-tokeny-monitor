import { describe, it, expect } from "vitest";
import type { ActivityRow } from "@/lib/csv-parser";
import {
  computeTotals,
  costByModel,
  costByProvider,
  dateRangeOf,
  filterByDate,
  timeSeries,
  toLocalDateKey,
} from "@/lib/aggregations";

function row(p: Partial<ActivityRow>): ActivityRow {
  return {
    generation_id: Math.random().toString(36),
    created_at: "2026-05-01 10:00:00",
    cost_total: 0,
    cost_web_search: 0,
    cost_cache: 0,
    cost_file_processing: 0,
    byok_usage_inference: 0,
    tokens_prompt: 0,
    tokens_completion: 0,
    tokens_reasoning: 0,
    tokens_cached: 0,
    model_permaslug: "openai/gpt-5",
    provider_name: "OpenAI",
    variant: "",
    cancelled: false,
    streamed: false,
    user: "",
    finish_reason_raw: "",
    finish_reason_normalized: "",
    generation_time_ms: 0,
    time_to_first_token_ms: 0,
    app_name: "",
    api_key_name: "",
    provider_source: "openrouter",
    request_count: 1,
    ...p,
  };
}

const rows = [
  row({ created_at: "2026-05-01 10:00:00", cost_total: 1, tokens_prompt: 10, tokens_completion: 5, generation_time_ms: 100 }),
  row({ created_at: "2026-05-02 23:30:00", cost_total: 2, tokens_reasoning: 7, generation_time_ms: 300, model_permaslug: "anthropic/claude", provider_name: "Anthropic" }),
  // aggregated Admin-API row: many requests, no timing
  row({ created_at: "2026-05-03T00:00:00Z", cost_total: 4, request_count: 50, provider_source: "anthropic", model_permaslug: "anthropic/claude", provider_name: "Anthropic" }),
];

describe("aggregations", () => {
  it("computes totals using request_count and timing-only averages", () => {
    expect(computeTotals(rows)).toEqual({ totalCost: 7, totalRequests: 52, totalTokens: 22, avgGenTime: 200 });
    expect(computeTotals([])).toEqual({ totalCost: 0, totalRequests: 0, totalTokens: 0, avgGenTime: 0 });
  });

  it("groups cost by model and provider, sorted desc", () => {
    expect(costByModel(rows)).toEqual([
      { model: "claude", fullModel: "anthropic/claude", cost: 6 },
      { model: "gpt-5", fullModel: "openai/gpt-5", cost: 1 },
    ]);
    expect(costByProvider(rows)).toEqual([
      { provider: "Anthropic", cost: 6, requests: 51 },
      { provider: "OpenAI", cost: 1, requests: 1 },
    ]);
  });

  it("filters by local calendar dates (inclusive), not UTC-shifted ISO dates", () => {
    // Local midnight; toISOString() would shift to the previous day east of UTC.
    const from = new Date(2026, 4, 2, 0, 0, 0);
    const to = new Date(2026, 4, 2, 0, 0, 0);
    expect(toLocalDateKey(from)).toBe("2026-05-02");
    expect(filterByDate(rows, { from, to }).map((r) => r.created_at)).toEqual(["2026-05-02 23:30:00"]);
    expect(filterByDate(rows, null)).toBe(rows);
  });

  it("computes the data date range and a sorted time series", () => {
    expect(dateRangeOf(rows)).toEqual({ from: "2026-05-01 10:00:00", to: "2026-05-03T00:00:00Z" });
    expect(dateRangeOf([])).toBeNull();
    const ts = timeSeries([...rows].reverse());
    expect(ts.map((p) => p.fullTime)).toEqual(rows.map((r) => r.created_at));
    expect(ts[0]).toMatchObject({ time: "10:00", model: "gpt-5" });
  });
});
