// Client types for share links, exports and the monthly report (mirror server/usage-export.ts).
export type SharePeriod = { type: "rolling"; days: 7 | 30 | 90 | 365 } | { type: "month" } | { type: "range"; from: string; to: string };

export interface ShareScope {
  period: SharePeriod;
  providers: string[];
  show_amounts: boolean;
  currency: "USD" | "CZK";
}

export interface ShareLink {
  id: string;
  label: string | null;
  scope: Partial<ShareScope>;
  created_at: string;
  expires_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
}

export interface SharedMetric { requests: number; tokens: number; cost_pct: number; cost_usd?: number }

export interface SharedPayload {
  label: string | null;
  period: SharePeriod & { from: string; to: string; tz: string };
  providers_filter: string[];
  show_amounts: boolean;
  currency: "USD" | "CZK";
  usd_czk?: number;
  rate_date?: string | null;
  created_at: string;
  expires_at: string | null;
  generated_at: string;
  totals: { requests: number; input_tokens: number; output_tokens: number; cost_usd?: number };
  daily: Array<SharedMetric & { date: string }>;
  providers: Array<SharedMetric & { provider: string }>;
  models: Array<SharedMetric & { model: string; provider: string }>;
}

export const shareUrl = (token: string, origin = typeof window === "undefined" ? "https://tokeny.martinpohl.cz" : window.location.origin) =>
  `${origin}/s/${token}`;

/** Today in Prague ("YYYY-MM-DD"), the day basis of exports, reports and share links. */
export const pragueToday = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

export interface ReportRow { day?: string; provider?: string; model?: string; requests: number; tokens: number; cost_usd: number }
export interface MonthlyReport {
  month: string; from: string; to: string; tz: string; days_in_month: number; generated_at: string;
  usd_czk: number; rate_date: string | null;
  totals: { requests: number; input_tokens: number; output_tokens: number; cost_usd: number };
  previous: { month: string; cost_usd: number; requests: number };
  daily: ReportRow[]; providers: ReportRow[]; models: ReportRow[];
  budget: { amount: number; currency: "USD" | "CZK" } | null;
}
