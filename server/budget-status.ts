// Budget progress + month-end forecast for one user (Pro). Shared by GET /api/budget and the daily cron.
import type { Db } from "./db.js";
import { FORECAST_WINDOW_DAYS, forecastMonth, type Forecast } from "./lib/forecast.js";
import { evaluateAlerts, toUsd, type AlertCandidate, type ScopeStatus } from "./lib/budget.js";
import { dailyCostsBySource, getExchangeRate, type BudgetRow } from "./repo.js";

const DAY = 86_400_000;
export const FALLBACK_USD_CZK = 23.5;

export interface BudgetStatus {
  period: string;
  usd_czk: number;
  total: ScopeStatus;
  providers: Array<ScopeStatus & { has_budget: boolean }>;
  /** This month's cost per UTC day (for the chart). */
  days: Array<{ date: string; cost_usd: number }>;
}

export async function budgetStatus(db: Db, userId: string, cfg: BudgetRow | null, now = new Date(), usdCzk?: number): Promise<BudgetStatus> {
  const rate = usdCzk ?? (await getExchangeRate(db))?.rate ?? FALLBACK_USD_CZK;
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const windowStart = new Date(Math.min(monthStart.getTime(), now.getTime() - (FORECAST_WINDOW_DAYS + 1) * DAY));
  const { days, firsts } = await dailyCostsBySource(db, userId, windowStart.toISOString().slice(0, 10));

  const total: Record<string, number> = {};
  const bySource: Record<string, Record<string, number>> = {};
  for (const r of days) {
    total[r.day] = (total[r.day] ?? 0) + Number(r.cost);
    (bySource[r.source] ??= {})[r.day] = (bySource[r.source]?.[r.day] ?? 0) + Number(r.cost);
  }
  const firstAll = firsts.map((f) => f.first_day).sort()[0] ?? null;
  const firstBy = Object.fromEntries(firsts.map((f) => [f.source, f.first_day]));
  const usd = (amount: number | undefined | null) => (cfg && amount ? toUsd(Number(amount), cfg.budget_currency, rate) : null);

  const f: Forecast = forecastMonth(total, firstAll, now);
  const pb = (cfg?.provider_budgets ?? {}) as Record<string, number>;
  const sources = [...new Set([...Object.keys(bySource), ...Object.keys(pb)])].sort();
  const providers = sources
    .map((s) => ({ scope: s, budget_usd: usd(pb[s]), has_budget: !!pb[s], forecast: forecastMonth(bySource[s] ?? {}, firstBy[s] ?? null, now) }))
    .filter((p) => p.has_budget || p.forecast.spent_usd > 0);

  const period = f.period;
  const dayList = Object.entries(total)
    .filter(([d]) => d.startsWith(period))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, c]) => ({ date, cost_usd: Math.round(c * 1e6) / 1e6 }));
  return { period, usd_czk: rate, total: { scope: "total", budget_usd: usd(cfg?.budget_amount), forecast: f }, providers, days: dayList };
}

export function alertsFor(cfg: BudgetRow, status: BudgetStatus): AlertCandidate[] {
  return evaluateAlerts(cfg, [status.total, ...status.providers.filter((p) => p.has_budget)]);
}
