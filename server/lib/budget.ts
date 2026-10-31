/**
 * Budget rules — PURE. Budgets are stored in the user's chosen currency (USD or CZK) and compared
 * in USD at the current ČNB rate. Alerts are deduped per (period, kind, scope, threshold) by the
 * unique key on public.budget_events, so the daily cron can run any number of times.
 */
import type { Forecast } from "./forecast.js";

export const BUDGET_CURRENCIES = ["USD", "CZK"] as const;
export type BudgetCurrency = (typeof BUDGET_CURRENCIES)[number];
export const DEFAULT_THRESHOLDS = [50, 80, 100];
export const MAX_THRESHOLDS = 6;
/** provider_source values that can carry their own budget (same list as activity_rows). */
export const BUDGET_PROVIDERS = ["openrouter", "anthropic", "openai", "gemini", "mistral", "groq", "xai", "cursor", "grok-bot"] as const;
export const MAX_BUDGET = 10_000_000;

export interface BudgetConfig {
  budget_amount: number;
  budget_currency: BudgetCurrency;
  thresholds: number[];
  forecast_alert: boolean;
  /** provider_source → amount in budget_currency */
  provider_budgets: Record<string, number>;
  enabled: boolean;
}

export type ParsedBudget = { ok: true; value: BudgetConfig } | { ok: false; error: string };

const isAmount = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n > 0 && n <= MAX_BUDGET;

/** Validates a PUT body. Accepts the legacy {monthly_budget_usd, threshold_pct} shape too. */
export function parseBudgetInput(b: any): ParsedBudget {
  if (!b || typeof b !== "object") return { ok: false, error: "Invalid body" };
  const legacy = b.budget_amount === undefined && b.monthly_budget_usd !== undefined;
  const amount = Number(legacy ? b.monthly_budget_usd : b.budget_amount);
  if (!isAmount(amount)) return { ok: false, error: "Invalid budget" };
  const currency = legacy ? "USD" : b.budget_currency ?? "USD";
  if (!(BUDGET_CURRENCIES as readonly string[]).includes(currency)) return { ok: false, error: "Invalid currency" };
  let thresholds: number[] = DEFAULT_THRESHOLDS;
  if (Array.isArray(b.thresholds)) thresholds = b.thresholds.map(Number);
  else if (legacy && b.threshold_pct !== undefined) thresholds = [Number(b.threshold_pct)];
  thresholds = [...new Set(thresholds)].sort((x, y) => x - y);
  if (thresholds.length > MAX_THRESHOLDS || thresholds.some((t) => !Number.isInteger(t) || t < 1 || t > 200)) {
    return { ok: false, error: "Invalid thresholds" };
  }
  const pb: Record<string, number> = {};
  if (b.provider_budgets != null) {
    if (typeof b.provider_budgets !== "object" || Array.isArray(b.provider_budgets)) return { ok: false, error: "Invalid provider budgets" };
    for (const [k, v] of Object.entries(b.provider_budgets)) {
      if (v === null || v === "" || v === 0) continue;
      if (!(BUDGET_PROVIDERS as readonly string[]).includes(k) || !isAmount(Number(v))) return { ok: false, error: "Invalid provider budgets" };
      pb[k] = Number(v);
    }
  }
  return {
    ok: true,
    value: { budget_amount: amount, budget_currency: currency, thresholds, forecast_alert: b.forecast_alert !== false, provider_budgets: pb, enabled: b.enabled !== false },
  };
}

export const toUsd = (amount: number, currency: BudgetCurrency, usdCzk: number) => (currency === "CZK" ? amount / usdCzk : amount);

export interface ScopeStatus {
  scope: string; // "total" or a provider_source
  budget_usd: number | null;
  forecast: Forecast;
}

export interface AlertCandidate {
  kind: "threshold" | "forecast";
  scope: string;
  threshold_pct: number; // 0 for forecast alerts
  spent_usd: number;
  budget_usd: number;
  forecast_usd: number | null;
}

/** Forecast alerts need at least this many observed days (fewer = too noisy to warn about). */
export const FORECAST_ALERT_MIN_DAYS = 3;

/** Which alerts apply right now. Highest crossed threshold AND every lower one are returned (dedupe happens in the DB). */
export function evaluateAlerts(cfg: Pick<BudgetConfig, "thresholds" | "forecast_alert" | "enabled">, scopes: ScopeStatus[]): AlertCandidate[] {
  if (!cfg.enabled) return [];
  const out: AlertCandidate[] = [];
  for (const s of scopes) {
    if (!s.budget_usd || s.budget_usd <= 0) continue;
    const spent = s.forecast.spent_usd;
    const pct = (spent / s.budget_usd) * 100;
    for (const t of cfg.thresholds) {
      if (pct >= t) out.push({ kind: "threshold", scope: s.scope, threshold_pct: t, spent_usd: spent, budget_usd: s.budget_usd, forecast_usd: s.forecast.forecast_usd });
    }
    const f = s.forecast;
    if (cfg.forecast_alert && f.forecast_usd != null && f.days_observed >= FORECAST_ALERT_MIN_DAYS && f.forecast_usd > s.budget_usd && spent < s.budget_usd) {
      out.push({ kind: "forecast", scope: s.scope, threshold_pct: 0, spent_usd: spent, budget_usd: s.budget_usd, forecast_usd: f.forecast_usd });
    }
  }
  return out;
}
