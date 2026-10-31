/**
 * Month-end spend forecast — PURE (no I/O) so the server, the cron and the tests share one method.
 *
 * Method ("weighted run-rate"):
 *  - Rate = exponentially weighted mean of the last ≤ 28 COMPLETE days (today is still running),
 *    half-life 7 days, so recent days count more than older ones. Days before the user's first
 *    usage row are not counted (we do not know them); days after it with no rows count as 0.
 *  - Forecast = spent so far this month + rate × remaining days (incl. the rest of today).
 *  - Range (~80 %) = ±1.28 σ, where σ combines day-to-day variation over the remaining days and
 *    the uncertainty of the rate itself (fewer observed days → wider). Never below what is spent.
 *  - Confidence: none (0 complete days), low (< 7), medium (< 14), high (≥ 14).
 * All days are calendar days in the user's time zone (Europe/Prague by default, DST-safe): the month,
 * "today" and how much of today is left (23/24/25-hour days) all follow local midnight.
 */

export const FORECAST_WINDOW_DAYS = 28;
export const FORECAST_HALF_LIFE_DAYS = 7;
const Z80 = 1.2816;

export type ForecastConfidence = "none" | "low" | "medium" | "high";

export interface Forecast {
  /** "YYYY-MM" in the forecast time zone. */
  period: string;
  spent_usd: number;
  /** Point forecast for the whole month; null when there is no complete day to learn from. */
  forecast_usd: number | null;
  low_usd: number | null;
  high_usd: number | null;
  /** Weighted daily rate used for the projection. */
  daily_rate_usd: number | null;
  confidence: ForecastConfidence;
  /** Complete days that fed the rate. */
  days_observed: number;
  day_of_month: number;
  days_in_month: number;
  /** Days left incl. the unfinished rest of today (fractional). */
  days_remaining: number;
  method: "weighted_run_rate";
}

export const BUDGET_TZ = "Europe/Prague";

const round = (n: number) => Math.round(n * 1e6) / 1e6;
const dayFmt = new Map<string, Intl.DateTimeFormat>();
const partFmt = new Map<string, Intl.DateTimeFormat>();

/** Calendar day ("YYYY-MM-DD") of an instant in a time zone. */
export function localDay(d: Date | number, tz: string = BUDGET_TZ): string {
  let f = dayFmt.get(tz);
  if (!f) dayFmt.set(tz, (f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })));
  return f.format(typeof d === "number" ? new Date(d) : d);
}

/** UTC offset of a time zone at an instant, in ms (Prague: +1 h in winter, +2 h in summer). */
function offsetMs(at: number, tz: string): number {
  let f = partFmt.get(tz);
  if (!f) partFmt.set(tz, (f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  })));
  const p = Object.fromEntries(f.formatToParts(new Date(at)).map((x) => [x.type, x.value]));
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return wall - Math.floor(at / 1000) * 1000;
}

/** The UTC instant of local midnight that starts `day` in `tz`. */
export function localMidnight(day: string, tz: string = BUDGET_TZ): number {
  const [y, m, d] = day.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d);
  let t = wall - offsetMs(wall, tz);
  t = wall - offsetMs(t, tz); // second pass lands on the right side of a DST switch
  return t;
}

/** Calendar arithmetic on "YYYY-MM-DD" (no time zone involved). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * @param daily  cost per local day ("YYYY-MM-DD" → USD); may include days before this month.
 * @param firstDataDay first local day the user has any usage row (or null for none).
 * @param tz     time zone the days are in (default Europe/Prague).
 */
export function forecastMonth(daily: Record<string, number>, firstDataDay: string | null, now: Date = new Date(), tz: string = BUDGET_TZ): Forecast {
  const today = localDay(now, tz);
  const [y, m, dayOfMonth] = today.split("-").map(Number);
  const period = today.slice(0, 7);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const todayStart = localMidnight(today, tz);
  const todayLen = localMidnight(addDays(today, 1), tz) - todayStart;
  const todayElapsed = Math.min(1, Math.max(0, (now.getTime() - todayStart) / todayLen));
  const daysRemaining = daysInMonth - dayOfMonth + (1 - todayElapsed);

  let spent = 0;
  for (const [d, v] of Object.entries(daily)) if (d.startsWith(period) && d <= today) spent += Number(v) || 0;

  // complete days, newest first: yesterday (age 0) back to the window / first data day
  const xs: Array<{ age: number; v: number }> = [];
  if (firstDataDay) {
    for (let age = 0; age < FORECAST_WINDOW_DAYS; age++) {
      const d = addDays(today, -(age + 1));
      if (d < firstDataDay.slice(0, 10)) break;
      xs.push({ age, v: Math.max(0, Number(daily[d]) || 0) });
    }
  }
  const n = xs.length;
  const base = {
    period, spent_usd: round(spent), day_of_month: dayOfMonth, days_in_month: daysInMonth,
    days_remaining: round(daysRemaining), days_observed: n, method: "weighted_run_rate" as const,
  };
  if (n === 0) return { ...base, forecast_usd: null, low_usd: null, high_usd: null, daily_rate_usd: null, confidence: "none" };

  let sw = 0, sw2 = 0, swx = 0;
  for (const { age, v } of xs) {
    const w = Math.pow(0.5, age / FORECAST_HALF_LIFE_DAYS);
    sw += w; sw2 += w * w; swx += w * v;
  }
  const rate = swx / sw;
  let varW = 0;
  for (const { age, v } of xs) varW += Math.pow(0.5, age / FORECAST_HALF_LIFE_DAYS) * (v - rate) ** 2;
  varW /= sw;
  const nEff = (sw * sw) / sw2;
  // one observed day says nothing about spread: assume σ = rate (±100 % per day)
  const sd = n > 1 ? Math.sqrt(varW * (nEff / Math.max(nEff - 1, 1e-9))) : rate;
  const R = daysRemaining;
  const total = Math.sqrt(R * sd * sd + (R * sd) ** 2 / nEff);
  const forecast = spent + rate * R;
  const confidence: ForecastConfidence = n < 7 ? "low" : n < 14 ? "medium" : "high";
  return {
    ...base,
    forecast_usd: round(forecast),
    low_usd: round(Math.max(spent, forecast - Z80 * total)),
    high_usd: round(forecast + Z80 * total),
    daily_rate_usd: round(rate),
    confidence,
  };
}
