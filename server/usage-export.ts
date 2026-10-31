// Usage aggregates for exports (CSV/JSON), the printable monthly report and public share links.
// Days are Europe/Prague calendar days (same as budgets). Only aggregates leave this module:
// no row ids, keys, app/user names or account details.
import type { Db } from "./db.js";
import { addDays, BUDGET_TZ } from "./lib/forecast.js";
import { toCsv } from "./lib/csv.js";
import { daysBetween, type ShareScope, resolvePeriod } from "./lib/share-scope.js";
import { getBudgetAlert, getExchangeRate, utcHourToLocalDay } from "./repo.js";
import { FALLBACK_USD_CZK } from "./budget-status.js";

export const EXPORT_GROUPS = ["day", "provider", "model", "day_provider_model"] as const;
export type ExportGroup = (typeof EXPORT_GROUPS)[number];

export interface UsageCell {
  day: string;
  provider: string;
  model: string;
  requests: number;
  input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  cached_tokens: number;
  cost_usd: number;
}

const r6 = (n: number) => Math.round(n * 1e6) / 1e6;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Per local day × provider × model, inclusive [from, to] local days, optional provider filter. */
export async function usageCells(db: Db, userId: string, from: string, to: string, providers: string[] = []): Promise<UsageCell[]> {
  const { rows } = await db.query<{
    hour: string; provider: string; model: string; requests: number; tin: number; tout: number; treason: number; tcached: number; cost: number;
  }>(
    `select left(created_at, 13) as hour, provider_source as provider, model_permaslug as model,
            coalesce(sum(coalesce(request_count, 1)), 0)::float8 as requests,
            coalesce(sum(tokens_prompt), 0)::float8 as tin, coalesce(sum(tokens_completion), 0)::float8 as tout,
            coalesce(sum(tokens_reasoning), 0)::float8 as treason, coalesce(sum(tokens_cached), 0)::float8 as tcached,
            coalesce(sum(cost_total), 0)::float8 as cost
       from activity_rows
      where user_id = $1 and created_at >= $2 and created_at < $3
        and (cardinality($4::text[]) = 0 or provider_source = any($4::text[]))
      group by 1, 2, 3`,
    [userId, addDays(from, -1), addDays(to, 2), providers],
  );
  const acc = new Map<string, UsageCell>();
  for (const r of rows) {
    const day = utcHourToLocalDay(r.hour, BUDGET_TZ);
    if (!day || day < from || day > to) continue;
    const k = `${day}\u0000${r.provider}\u0000${r.model}`;
    let c = acc.get(k);
    if (!c) acc.set(k, (c = { day, provider: r.provider, model: r.model || "unknown", requests: 0, input_tokens: 0, output_tokens: 0, reasoning_tokens: 0, cached_tokens: 0, cost_usd: 0 }));
    c.requests += Number(r.requests); c.input_tokens += Number(r.tin); c.output_tokens += Number(r.tout);
    c.reasoning_tokens += Number(r.treason); c.cached_tokens += Number(r.tcached); c.cost_usd += Number(r.cost);
  }
  return [...acc.values()];
}

/** Re-group cells; keys that are not part of the grouping are emptied. Sorted for stable output. */
export function groupCells(cells: UsageCell[], group: ExportGroup): UsageCell[] {
  const key = (c: UsageCell) =>
    group === "day" ? c.day : group === "provider" ? c.provider : group === "model" ? `${c.model}\u0000${c.provider}` : `${c.day}\u0000${c.provider}\u0000${c.model}`;
  const acc = new Map<string, UsageCell>();
  for (const c of cells) {
    const k = key(c);
    let g = acc.get(k);
    if (!g) {
      acc.set(k, (g = {
        day: group === "day" || group === "day_provider_model" ? c.day : "",
        provider: group === "day" ? "" : c.provider,
        model: group === "model" || group === "day_provider_model" ? c.model : "",
        requests: 0, input_tokens: 0, output_tokens: 0, reasoning_tokens: 0, cached_tokens: 0, cost_usd: 0,
      }));
    }
    g.requests += c.requests; g.input_tokens += c.input_tokens; g.output_tokens += c.output_tokens;
    g.reasoning_tokens += c.reasoning_tokens; g.cached_tokens += c.cached_tokens; g.cost_usd += c.cost_usd;
  }
  const out = [...acc.values()].map((g) => ({ ...g, cost_usd: r6(g.cost_usd) }));
  if (group === "day") return out.sort((a, b) => a.day.localeCompare(b.day));
  if (group === "day_provider_model") return out.sort((a, b) => a.day.localeCompare(b.day) || b.cost_usd - a.cost_usd);
  return out.sort((a, b) => b.cost_usd - a.cost_usd || a.provider.localeCompare(b.provider));
}

async function rateInfo(db: Db) {
  const r = await getExchangeRate(db);
  return { usd_czk: r?.rate ?? FALLBACK_USD_CZK, rate_date: r?.source_date ?? null, rate_fallback: !r };
}

export function rateNote(currency: "USD" | "CZK", usd_czk: number, rate_date: string | null, lang: "cs" | "en") {
  const date = rate_date ?? (lang === "cs" ? "neznámé datum" : "unknown date");
  if (currency === "USD") return lang === "cs" ? "Částky jsou v USD, jak je účtují poskytovatelé." : "Amounts are in USD, as billed by the providers.";
  return lang === "cs"
    ? `Poskytovatelé účtují v USD. Kč jsou přepočtené aktuálním kurzem ČNB 1 USD = ${usd_czk} Kč (${date}), ne kurzem z data útraty.`
    : `Providers bill in USD. CZK uses the current ČNB rate 1 USD = ${usd_czk} CZK (${date}), not the rate on the day of spend.`;
}

export interface ExportParams { from: string; to: string; group: ExportGroup; currency: "USD" | "CZK"; providers: string[]; lang: "cs" | "en" }

export async function buildExport(db: Db, userId: string, p: ExportParams) {
  const [cells, rate] = await Promise.all([usageCells(db, userId, p.from, p.to, p.providers), rateInfo(db)]);
  const rows = groupCells(cells, p.group);
  const meta = {
    from: p.from, to: p.to, tz: BUDGET_TZ, group: p.group, currency: p.currency, providers: p.providers,
    usd_czk: rate.usd_czk, rate_date: rate.rate_date, note: rateNote(p.currency, rate.usd_czk, rate.rate_date, p.lang),
    generated_at: new Date().toISOString(),
  };
  const withCzk = p.currency === "CZK";
  const json = {
    meta,
    rows: rows.map((r) => ({
      ...(p.group === "day" || p.group === "day_provider_model" ? { date: r.day } : {}),
      ...(p.group !== "day" ? { provider: r.provider } : {}),
      ...(p.group === "model" || p.group === "day_provider_model" ? { model: r.model } : {}),
      requests: r.requests, input_tokens: r.input_tokens, output_tokens: r.output_tokens,
      reasoning_tokens: r.reasoning_tokens, cached_tokens: r.cached_tokens, cost_usd: r.cost_usd,
      ...(withCzk ? { cost_czk: r2(r.cost_usd * rate.usd_czk) } : {}),
    })),
  };
  const headers = [
    ...(p.group === "day" || p.group === "day_provider_model" ? ["date"] : []),
    ...(p.group !== "day" ? ["provider"] : []),
    ...(p.group === "model" || p.group === "day_provider_model" ? ["model"] : []),
    "requests", "input_tokens", "output_tokens", "reasoning_tokens", "cached_tokens", "cost_usd",
    ...(withCzk ? ["cost_czk", "usd_czk_rate", "rate_date"] : []),
  ];
  const csv = toCsv(headers, json.rows.map((r: any) => headers.map((h) => (h === "usd_czk_rate" ? rate.usd_czk : h === "rate_date" ? rate.rate_date ?? "" : r[h]))));
  return { json, csv, rowCount: rows.length };
}

const sum = (cells: UsageCell[]) => cells.reduce(
  (a, c) => ({ requests: a.requests + c.requests, input_tokens: a.input_tokens + c.input_tokens, output_tokens: a.output_tokens + c.output_tokens, cost_usd: a.cost_usd + c.cost_usd }),
  { requests: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0 },
);

/** Printable monthly report (Pro): totals, per day/provider/model, previous month and budget. */
export async function buildMonthlyReport(db: Db, userId: string, month: string) {
  const [y, m] = month.split("-").map(Number);
  const from = `${month}-01`;
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const prevFrom = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
  const prevTo = addDays(from, -1);
  const [cells, prevCells, rate, budget] = await Promise.all([
    usageCells(db, userId, from, to), usageCells(db, userId, prevFrom, prevTo), rateInfo(db), getBudgetAlert(db, userId),
  ]);
  const t = sum(cells), pt = sum(prevCells);
  const pick = (g: UsageCell[]) => g.map((c) => ({ day: c.day || undefined, provider: c.provider || undefined, model: c.model || undefined, requests: c.requests, tokens: c.input_tokens + c.output_tokens, cost_usd: c.cost_usd }));
  return {
    month, from, to, tz: BUDGET_TZ, days_in_month: daysBetween(from, to), generated_at: new Date().toISOString(),
    usd_czk: rate.usd_czk, rate_date: rate.rate_date,
    totals: { ...t, cost_usd: r6(t.cost_usd) },
    previous: { month: prevFrom.slice(0, 7), cost_usd: r6(pt.cost_usd), requests: pt.requests },
    daily: pick(groupCells(cells, "day")),
    providers: pick(groupCells(cells, "provider")),
    models: pick(groupCells(cells, "model").slice(0, 20)),
    budget: budget && budget.enabled ? { amount: Number(budget.budget_amount), currency: budget.budget_currency } : null,
  };
}

/**
 * Public payload of a share link. Built from the stored scope only; contains no account data.
 * With show_amounts = false no money value is present at all (only percentages, tokens, requests).
 */
export async function buildSharedPayload(db: Db, ownerId: string, share: { label: string | null; created_at: string; expires_at: string | null }, scope: ShareScope, now = new Date()) {
  const { from, to } = resolvePeriod(scope.period, now);
  const [cells, rate] = await Promise.all([usageCells(db, ownerId, from, to, scope.providers), rateInfo(db)]);
  const total = sum(cells);
  const pct = (v: number) => (total.cost_usd > 0 ? Math.round((v / total.cost_usd) * 1000) / 10 : 0);
  const money = (v: number) => (scope.show_amounts ? { cost_usd: r6(v) } : {});
  const shape = (g: UsageCell[]) => g.map((c) => ({ requests: c.requests, tokens: c.input_tokens + c.output_tokens, cost_pct: pct(c.cost_usd), ...money(c.cost_usd) }));
  const days = groupCells(cells, "day");
  // every day of the range, so charts have no gaps
  const byDay = new Map(days.map((d) => [d.day, d]));
  const allDays: string[] = [];
  for (let d = from; d <= to && allDays.length <= 800; d = addDays(d, 1)) allDays.push(d);
  return {
    label: share.label,
    period: { ...scope.period, from, to, tz: BUDGET_TZ },
    providers_filter: scope.providers,
    show_amounts: scope.show_amounts,
    currency: scope.currency,
    ...(scope.show_amounts ? { usd_czk: rate.usd_czk, rate_date: rate.rate_date } : {}),
    created_at: share.created_at,
    expires_at: share.expires_at,
    generated_at: now.toISOString(),
    totals: { requests: total.requests, input_tokens: total.input_tokens, output_tokens: total.output_tokens, ...money(total.cost_usd) },
    daily: allDays.map((d) => {
      const c = byDay.get(d);
      return { date: d, requests: c?.requests ?? 0, tokens: c ? c.input_tokens + c.output_tokens : 0, cost_pct: pct(c?.cost_usd ?? 0), ...money(c?.cost_usd ?? 0) };
    }),
    providers: groupCells(cells, "provider").map((c) => ({ provider: c.provider, ...shape([c])[0] })),
    models: groupCells(cells, "model").slice(0, 10).map((c) => ({ model: c.model, provider: c.provider, ...shape([c])[0] })),
  };
}
