import type { ActivityRow } from "@/lib/csv-parser";

/** Local calendar date (YYYY-MM-DD). `toISOString()` would shift to UTC and cause off-by-one days. */
export function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function filterByDate(rows: ActivityRow[], range: { from: Date; to: Date } | null): ActivityRow[] {
  if (!range) return rows;
  const from = toLocalDateKey(range.from);
  const to = toLocalDateKey(range.to);
  return rows.filter((r) => {
    const d = r.created_at.substring(0, 10);
    return d >= from && d <= to;
  });
}

const reqs = (r: ActivityRow) => r.request_count ?? 1;

export interface Totals {
  totalCost: number;
  /** Aggregated Admin-API rows carry request_count > 1, per-generation rows 1. */
  totalRequests: number;
  totalTokens: number;
  /** Average over rows that have timing info only (aggregated rows have 0). */
  avgGenTime: number;
}

export function computeTotals(rows: ActivityRow[]): Totals {
  let totalCost = 0;
  let totalRequests = 0;
  let totalTokens = 0;
  let timedSum = 0;
  let timedCount = 0;
  for (const r of rows) {
    totalCost += r.cost_total;
    totalRequests += reqs(r);
    totalTokens += r.tokens_prompt + r.tokens_completion + r.tokens_reasoning;
    if (r.generation_time_ms > 0) {
      timedSum += r.generation_time_ms;
      timedCount += 1;
    }
  }
  return { totalCost, totalRequests, totalTokens, avgGenTime: timedCount > 0 ? timedSum / timedCount : 0 };
}

export function costByModel(rows: ActivityRow[]) {
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.model_permaslug, (map.get(r.model_permaslug) ?? 0) + r.cost_total);
  return [...map.entries()]
    .map(([m, cost]) => ({ model: m.split("/").pop() || m, fullModel: m, cost }))
    .sort((a, b) => b.cost - a.cost);
}

export function costByProvider(rows: ActivityRow[]) {
  const map = new Map<string, { cost: number; requests: number }>();
  for (const r of rows) {
    const cur = map.get(r.provider_name) ?? { cost: 0, requests: 0 };
    cur.cost += r.cost_total;
    cur.requests += reqs(r);
    map.set(r.provider_name, cur);
  }
  return [...map.entries()].map(([provider, v]) => ({ provider, ...v })).sort((a, b) => b.cost - a.cost);
}

export function dateRangeOf(rows: ActivityRow[]): { from: string; to: string } | null {
  if (rows.length === 0) return null;
  let from = rows[0].created_at;
  let to = rows[0].created_at;
  for (const r of rows) {
    if (r.created_at < from) from = r.created_at;
    if (r.created_at > to) to = r.created_at;
  }
  return { from, to };
}

export function timeSeries(rows: ActivityRow[]) {
  return [...rows]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((r) => ({
      time: r.created_at.substring(11, 16),
      fullTime: r.created_at,
      cost: r.cost_total,
      tokens_prompt: r.tokens_prompt,
      tokens_completion: r.tokens_completion,
      tokens_reasoning: r.tokens_reasoning,
      tokens_cached: r.tokens_cached,
      generation_time_ms: r.generation_time_ms,
      time_to_first_token_ms: r.time_to_first_token_ms,
      model: r.model_permaslug.split("/").pop() || r.model_permaslug,
    }));
}
