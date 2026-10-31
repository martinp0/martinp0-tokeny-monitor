// Read-only spend summary for the native apps (iPhone, widgets, Apple Watch, macOS menu bar).
// Same response shape (version 1) as the former Supabase function. Aggregates only.
import type { Db } from "./db.js";
import { freeHistoryFloor } from "./lib/plan.js";
import { getBudgetAlert, getExchangeRate } from "./repo.js";

export function validTz(tz: string | null): string {
  if (!tz) return "Europe/Prague";
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return tz;
  } catch {
    return "Europe/Prague";
  }
}

function dayKey(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

const round = (n: number, d = 4) => +n.toFixed(d);
const MAX_ROWS = 100_000;

export async function usageSummary(db: Db, userId: string, isPro: boolean, tzParam: string | null, now = new Date()) {
  const tz = validTz(tzParam);
  const today = dayKey(now, tz);
  const monthKey = today.slice(0, 7);
  const [y, mo] = monthKey.split("-").map(Number);
  const prevMonthKey = mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
  const fullSince = new Date(Date.UTC(mo === 1 ? y - 1 : y, mo === 1 ? 11 : mo - 2, 1) - 2 * 86_400_000);
  const freeFloor = new Date(`${freeHistoryFloor(now)}T00:00:00Z`);
  const since = isPro || freeFloor < fullSince ? fullSince : freeFloor;
  const last30 = new Set(Array.from({ length: 30 }, (_, i) => dayKey(new Date(now.getTime() - i * 86_400_000), tz)));

  const { rows } = await db.query<{
    created_at: string; cost_total: number; tokens_prompt: number; tokens_completion: number;
    request_count: number | null; model_permaslug: string; provider_name: string;
  }>(
    `select created_at, cost_total::float8 as cost_total, tokens_prompt, tokens_completion, request_count,
            model_permaslug, provider_name
       from activity_rows where user_id = $1 and created_at >= $2
      order by created_at asc, id asc limit $3`,
    [userId, since.toISOString(), MAX_ROWS],
  );

  const zero = () => ({ cost_usd: 0, tokens: 0, requests: 0 });
  const todayAgg = zero(), monthAgg = zero(), prevAgg = zero();
  const daily: Record<string, number> = {};
  const models: Record<string, number> = {};
  const providers: Record<string, number> = {};
  let lastActivity: string | null = null;
  for (const r of rows) {
    const k = dayKey(new Date(r.created_at), tz);
    const cost = Number(r.cost_total) || 0;
    const tokens = (Number(r.tokens_prompt) || 0) + (Number(r.tokens_completion) || 0);
    const reqs = Number(r.request_count) || 1;
    const add = (a: ReturnType<typeof zero>) => { a.cost_usd += cost; a.tokens += tokens; a.requests += reqs; };
    if (k === today) add(todayAgg);
    if (k.startsWith(monthKey)) {
      add(monthAgg);
      models[r.model_permaslug] = (models[r.model_permaslug] ?? 0) + cost;
      providers[r.provider_name] = (providers[r.provider_name] ?? 0) + cost;
    } else if (k.startsWith(prevMonthKey)) add(prevAgg);
    if (last30.has(k)) daily[k] = (daily[k] ?? 0) + cost;
    if (!lastActivity || r.created_at > lastActivity) lastActivity = r.created_at;
  }
  const dayOfMonth = Number(today.slice(8, 10));
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const [budget, rate] = await Promise.all([getBudgetAlert(db, userId), getExchangeRate(db)]);
  const fin = (a: ReturnType<typeof zero>) => ({ ...a, cost_usd: round(a.cost_usd) });
  const top = (o: Record<string, number>, n: number) =>
    Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, c]) => ({ name, cost_usd: round(c) }));
  return {
    version: 1,
    plan: isPro ? "pro" : "free",
    generated_at: now.toISOString(),
    tz,
    today: fin(todayAgg),
    month: { ...fin(monthAgg), key: monthKey },
    previous_month: isPro ? { ...fin(prevAgg), key: prevMonthKey } : null,
    forecast_month_usd: isPro ? round(dayOfMonth > 0 ? (monthAgg.cost_usd / dayOfMonth) * daysInMonth : 0) : null,
    budget: budget
      ? { monthly_usd: Number(budget.monthly_budget_usd), threshold_pct: Number(budget.threshold_pct), enabled: !!budget.enabled }
      : null,
    usd_czk: rate?.rate ? { rate: Number(rate.rate), date: rate.source_date ?? null } : null,
    daily: [...last30].sort().map((date) => ({ date, cost_usd: round(daily[date] ?? 0) })),
    top_models: top(models, 5),
    providers: top(providers, 10),
    last_activity_at: lastActivity,
  };
}
