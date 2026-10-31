// Client types for /api/budget, /api/budget-alert and /api/alerts (server: server/budget-status.ts).
export type BudgetCurrency = "USD" | "CZK";
export type ForecastConfidence = "none" | "low" | "medium" | "high";

export interface Forecast {
  period: string;
  spent_usd: number;
  forecast_usd: number | null;
  low_usd: number | null;
  high_usd: number | null;
  daily_rate_usd: number | null;
  confidence: ForecastConfidence;
  days_observed: number;
  day_of_month: number;
  days_in_month: number;
  days_remaining: number;
  method: "weighted_run_rate";
}

export interface ScopeStatus {
  scope: string;
  budget_usd: number | null;
  forecast: Forecast;
  has_budget?: boolean;
}

export interface BudgetStatus {
  period: string;
  usd_czk: number;
  total: ScopeStatus;
  providers: ScopeStatus[];
  days: Array<{ date: string; cost_usd: number }>;
}

export interface BudgetConfig {
  id: string;
  budget_amount: number;
  budget_currency: BudgetCurrency;
  thresholds: number[];
  forecast_alert: boolean;
  provider_budgets: Record<string, number>;
  enabled: boolean;
}

export interface BudgetAlertEvent {
  id: string;
  period: string;
  kind: "threshold" | "forecast";
  scope: string;
  threshold_pct: number;
  spent_usd: number;
  budget_usd: number;
  forecast_usd: number | null;
  read_at: string | null;
  created_at: string;
}

export const BUDGET_PROVIDER_LABELS: Record<string, string> = {
  openrouter: "OpenRouter", anthropic: "Anthropic", openai: "OpenAI", gemini: "Google Gemini", mistral: "Mistral",
  groq: "Groq", xai: "xAI", cursor: "Cursor", "grok-bot": "Grok Bot",
};
export const providerLabel = (s: string) => BUDGET_PROVIDER_LABELS[s] ?? s;

export const THRESHOLD_CHOICES = [25, 50, 75, 80, 90, 100, 120];

/** Fires when alerts change (e.g. after "mark all read") so the badge can refresh. */
export const ALERTS_CHANGED = "tokeny:alerts-changed";
