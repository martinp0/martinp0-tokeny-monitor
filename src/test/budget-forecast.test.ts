// @vitest-environment node
// Budget + month-end forecast: forecast math, input validation, threshold dedupe in the daily cron,
// Pro gating on the server and cross-user isolation (real schema on PGlite, real HTTP API).
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Db } from "../../server/db";
import { createApp } from "../../server/app";
import { checkBudgets } from "../../server/cron";
import { addDays, forecastMonth, localDay, localMidnight } from "../../server/lib/forecast";
import { budgetStatus } from "../../server/budget-status";
import { utcHourToLocalDay } from "../../server/repo";
import { usageSummary } from "../../server/usage-summary";
import { evaluateAlerts, parseBudgetInput } from "../../server/lib/budget";

const days = (from: string, n: number, v: number | ((i: number) => number)) => {
  const out: Record<string, number> = {};
  const t = Date.parse(from + "T00:00:00Z");
  for (let i = 0; i < n; i++) out[new Date(t + i * 86_400_000).toISOString().slice(0, 10)] = typeof v === "number" ? v : v(i);
  return out;
};

describe("forecastMonth (weighted run-rate)", () => {
  const noon15 = new Date("2026-11-15T11:00:00Z"); // 12:00 in Prague (CET); 30-day month, 15.5 days left

  it("constant spend → exact projection, tight range, high confidence", () => {
    const f = forecastMonth(days("2026-10-01", 46, 2), "2026-10-01", noon15);
    expect(f.period).toBe("2026-11");
    expect(f.spent_usd).toBeCloseTo(30, 6); // Nov 1..15 incl. today
    expect(f.daily_rate_usd).toBeCloseTo(2, 6);
    expect(f.forecast_usd).toBeCloseTo(30 + 2 * 15.5, 6);
    expect(f.low_usd).toBeCloseTo(f.forecast_usd!, 6);
    expect(f.high_usd).toBeCloseTo(f.forecast_usd!, 6);
    expect(f.confidence).toBe("high");
    expect(f.days_observed).toBe(28);
  });

  it("weights recent days more than older ones", () => {
    // old days cost 1, the last 7 complete days cost 5
    const d = days("2026-10-01", 45, (i) => (i >= 38 && i <= 44 ? 5 : 1));
    const f = forecastMonth(d, "2026-10-01", noon15);
    const plainMean = (7 * 5 + 21 * 1) / 28;
    expect(f.daily_rate_usd!).toBeGreaterThan(plainMean);
    expect(f.daily_rate_usd!).toBeLessThan(5);
  });

  it("no data → no forecast, confidence none", () => {
    const f = forecastMonth({}, null, noon15);
    expect(f.forecast_usd).toBeNull();
    expect(f.confidence).toBe("none");
    expect(f.spent_usd).toBe(0);
  });

  it("data only from today → spent known, no forecast yet", () => {
    const f = forecastMonth({ "2026-11-15": 3 }, "2026-11-15", noon15);
    expect(f.spent_usd).toBe(3);
    expect(f.forecast_usd).toBeNull();
    expect(f.days_observed).toBe(0);
  });

  it("few days → low confidence and a wide range that never goes below spent", () => {
    const f = forecastMonth({ "2026-11-13": 1, "2026-11-14": 3, "2026-11-15": 1 }, "2026-11-13", noon15);
    expect(f.days_observed).toBe(2);
    expect(f.confidence).toBe("low");
    expect(f.low_usd!).toBeGreaterThanOrEqual(f.spent_usd);
    expect(f.high_usd! - f.low_usd!).toBeGreaterThan(10);
  });

  it("days before the first usage row are not counted as zero", () => {
    const f = forecastMonth({ "2026-11-10": 4, "2026-11-11": 4, "2026-11-12": 4, "2026-11-13": 4, "2026-11-14": 4 }, "2026-11-10", noon15);
    expect(f.days_observed).toBe(5);
    expect(f.daily_rate_usd).toBeCloseTo(4, 6);
    expect(f.confidence).toBe("low");
  });

  it("first day of the month uses last month's days for the rate", () => {
    const f = forecastMonth(days("2026-10-01", 31, 1), "2026-10-01", new Date("2026-10-31T23:00:00Z")); // Prague midnight, Nov 1
    expect(f.spent_usd).toBe(0);
    expect(f.forecast_usd).toBeCloseTo(30, 6);
  });
});

describe("parseBudgetInput", () => {
  it("accepts the new shape and the legacy shape", () => {
    const a = parseBudgetInput({ budget_amount: 1000, budget_currency: "CZK", thresholds: [100, 50, 50, 80], provider_budgets: { openai: 300, anthropic: "" } });
    expect(a.ok && a.value).toMatchObject({ budget_amount: 1000, budget_currency: "CZK", thresholds: [50, 80, 100], provider_budgets: { openai: 300 }, forecast_alert: true });
    const l = parseBudgetInput({ monthly_budget_usd: 20, threshold_pct: 75 });
    expect(l.ok && l.value).toMatchObject({ budget_amount: 20, budget_currency: "USD", thresholds: [75] });
  });
  it("rejects bad values", () => {
    for (const b of [{}, { budget_amount: -1 }, { budget_amount: 10, budget_currency: "EUR" }, { budget_amount: 10, thresholds: [0] },
      { budget_amount: 10, thresholds: [1, 2, 3, 4, 5, 6, 7] }, { budget_amount: 10, provider_budgets: { evil: 5 } }, { budget_amount: 10, provider_budgets: { openai: -5 } }]) {
      expect(parseBudgetInput(b).ok, JSON.stringify(b)).toBe(false);
    }
  });
});

describe("evaluateAlerts", () => {
  const f = (spent: number, forecast: number | null, observed = 10) => ({
    period: "2026-11", spent_usd: spent, forecast_usd: forecast, low_usd: null, high_usd: null, daily_rate_usd: null,
    confidence: "medium" as const, days_observed: observed, day_of_month: 15, days_in_month: 30, days_remaining: 15, method: "weighted_run_rate" as const,
  });
  const cfg = { thresholds: [50, 80, 100], forecast_alert: true, enabled: true };
  it("returns every crossed threshold and a forecast warning", () => {
    const a = evaluateAlerts(cfg, [{ scope: "total", budget_usd: 100, forecast: f(85, 140) }]);
    expect(a.map((x) => `${x.kind}:${x.threshold_pct}`)).toEqual(["threshold:50", "threshold:80", "forecast:0"]);
  });
  it("no forecast warning with too few days, when disabled, or when already over", () => {
    expect(evaluateAlerts(cfg, [{ scope: "total", budget_usd: 100, forecast: f(10, 400, 2) }])).toEqual([]);
    expect(evaluateAlerts({ ...cfg, forecast_alert: false }, [{ scope: "total", budget_usd: 100, forecast: f(10, 400) }])).toEqual([]);
    expect(evaluateAlerts(cfg, [{ scope: "total", budget_usd: 100, forecast: f(120, 200) }]).some((x) => x.kind === "forecast")).toBe(false);
    expect(evaluateAlerts({ ...cfg, enabled: false }, [{ scope: "total", budget_usd: 100, forecast: f(120, 200) }])).toEqual([]);
  });
});

// ------------------------------------------------------------------ API + cron on a real schema
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"; // free
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"; // pro
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"; // pro
const users: Record<string, { id: string; email: string; name: string }> = {
  a: { id: A, email: "a@example.test", name: "A" }, b: { id: B, email: "b@example.test", name: "B" }, c: { id: C, email: "c@example.test", name: "C" },
};
let pg: PGlite;
let db: Db;
let app: ReturnType<typeof createApp>;
async function call(who: string | null, method: string, url: string, body?: unknown) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (who) headers["x-test-user"] = who;
  const res = await app.fetch(new Request(`https://tokeny.test${url}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }));
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text };
}
const iso = (d: Date) => d.toISOString();
async function seed(userId: string, source: string, perDay: number, nDays: number, now = new Date()) {
  for (let i = 0; i <= nDays; i++) {
    const d = new Date(now.getTime() - i * 86_400_000);
    await pg.query(
      "insert into activity_rows (user_id, generation_id, created_at, cost_total, provider_source) values ($1, $2, $3, $4, $5)",
      [userId, `${userId}-${source}-${i}`, iso(new Date(Math.min(d.getTime(), now.getTime() - 1000))), perDay, source],
    );
  }
}

beforeAll(async () => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  pg = new PGlite();
  await pg.exec(`create schema neon_auth;
    create table neon_auth."user" (id uuid primary key, name text, email text, "emailVerified" boolean default false,
      image text, "createdAt" timestamptz default now(), "updatedAt" timestamptz default now());`);
  await pg.exec(readFileSync(path.resolve(__dirname, "../../db/schema.sql"), "utf8").replace(/CREATE EXTENSION[^;]*;/i, ""));
  for (const u of Object.values(users)) await pg.query('insert into neon_auth."user" (id, name, email) values ($1, $2, $3)', [u.id, u.name, u.email]);
  for (const [u, n] of [[B, "b"], [C, "c"]]) {
    await pg.query("insert into subscriptions (user_id, stripe_customer_id, stripe_subscription_id, status, current_period_end) values ($1, $2, $3, 'active', now() + interval '30 days')", [u, `cus_${n}`, `sub_${n}`]);
  }
  db = { async query(text, params) { const r = await pg.query(text, params as unknown[]); return { rows: r.rows as never[], rowCount: r.affectedRows ?? r.rows.length }; } };
  app = createApp({ db: () => db, sessionUser: async (req) => { const u = users[req.headers.get("x-test-user") ?? ""]; return u ? { ...u, image: null, emailVerified: true } : null; } });
  await seed(A, "openai", 50, 20);
  await seed(B, "openai", 10, 40);
  await seed(B, "anthropic", 1, 40);
  await seed(C, "openrouter", 1000, 40);
}, 60_000);

describe("Pro gating (server-side)", () => {
  it("free user gets 403 pro_required on every budget/forecast/alerts route", async () => {
    for (const [m, u, body] of [["GET", "/api/budget"], ["GET", "/api/alerts"], ["POST", "/api/alerts/read", {}], ["PUT", "/api/budget-alert", { budget_amount: 10 }]] as const) {
      const r = await call("a", m, u, body);
      expect(r.status, `${m} ${u}`).toBe(403);
      expect(r.json.error).toBe("pro_required");
      expect(r.text).not.toContain("50"); // no numbers about A's spend leak through the 403
    }
  });
  it("unauthenticated → 401", async () => {
    for (const u of ["/api/budget", "/api/alerts"]) expect((await call(null, "GET", u)).status).toBe(401);
  });
  it("the cron ignores free users even with a budget row", async () => {
    await pg.query("insert into budget_alerts (user_id, monthly_budget_usd, budget_amount, thresholds) values ($1, 1, 1, '{50}')", [A]);
    await checkBudgets(db);
    expect((await pg.query("select count(*)::int n from budget_events where user_id = $1", [A])).rows[0]).toEqual({ n: 0 });
  });
});

describe("Pro budget, forecast and alerts", () => {
  it("saves a CZK budget with provider budgets and returns status in USD", async () => {
    const r = await call("b", "PUT", "/api/budget-alert", { budget_amount: 2350, budget_currency: "CZK", thresholds: [50, 80, 100], provider_budgets: { anthropic: 2.35 } });
    expect(r.status).toBe(200);
    expect(r.json.alert).toMatchObject({ budget_amount: 2350, budget_currency: "CZK", thresholds: [50, 80, 100] });
    expect(r.json.alert).not.toHaveProperty("notify_email");
    const s = await call("b", "GET", "/api/budget");
    expect(s.status).toBe(200);
    expect(s.json.status.total.budget_usd).toBeCloseTo(100, 6); // 2350 CZK at the 23.5 seed rate
    expect(s.json.status.total.forecast.forecast_usd).toBeGreaterThan(0);
    expect(s.json.status.total.forecast.confidence).toBe("high");
    const anth = s.json.status.providers.find((p: any) => p.scope === "anthropic");
    expect(anth.has_budget).toBe(true);
    expect(anth.budget_usd).toBeCloseTo(0.1, 6);
  });

  it("cron creates alerts once per period (dedupe on rerun)", async () => {
    const first = await checkBudgets(db);
    expect(first.flagged).toBeGreaterThan(0);
    const again = await checkBudgets(db);
    expect(again.flagged).toBe(0);
    const { rows } = await pg.query<{ kind: string; scope: string; threshold_pct: number }>("select kind, scope, threshold_pct from budget_events where user_id = $1", [B]);
    const keys = rows.map((r) => `${r.kind}:${r.scope}:${r.threshold_pct}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("threshold:anthropic:100"); // ≥ 1 USD spent of a 0.1 USD provider budget
  });

  it("alert center lists only the caller's alerts; marking read is scoped to the caller", async () => {
    await call("c", "PUT", "/api/budget-alert", { budget_amount: 10, budget_currency: "USD" });
    await checkBudgets(db);
    const b = await call("b", "GET", "/api/alerts");
    const c = await call("c", "GET", "/api/alerts");
    expect(b.json.unread).toBeGreaterThan(0);
    expect(c.json.unread).toBeGreaterThan(0);
    const bIds = new Set(b.json.alerts.map((x: any) => x.id));
    expect(c.json.alerts.some((x: any) => bIds.has(x.id))).toBe(false);
    // C tries to mark B's alerts read → nothing happens to B
    const m = await call("c", "POST", "/api/alerts/read", { ids: [...bIds] });
    expect(m.json.marked).toBe(0);
    expect((await call("b", "GET", "/api/alerts")).json.unread).toBe(b.json.unread);
    // B marks its own
    expect((await call("b", "POST", "/api/alerts/read", {})).json.marked).toBe(b.json.unread);
    expect((await call("b", "GET", "/api/alerts")).json.unread).toBe(0);
    expect((await call("c", "GET", "/api/alerts")).json.unread).toBe(c.json.unread);
  });

  it("status and budget of one user never include another user's spend", async () => {
    const b = (await call("b", "GET", "/api/budget")).json.status;
    const c = (await call("c", "GET", "/api/budget")).json.status;
    expect(b.providers.map((p: any) => p.scope).sort()).toEqual(["anthropic", "openai"]);
    expect(c.providers.map((p: any) => p.scope)).toEqual(["openrouter"]);
    expect(c.total.budget_usd).toBe(10);
    expect(b.total.forecast.spent_usd).toBeLessThan(1000);
  });

  it("rejects invalid budgets with 400", async () => {
    expect((await call("b", "PUT", "/api/budget-alert", { budget_amount: 10, thresholds: [500] })).status).toBe(400);
  });

  it("account deletion removes budget events", async () => {
    await pg.query('delete from neon_auth."user" where id = $1', [C]);
    expect((await pg.query("select count(*)::int n from budget_events where user_id = $1", [C])).rows[0]).toEqual({ n: 0 });
  });
});

describe("Europe/Prague months and days (DST-safe)", () => {
  it("local day, midnight and 23/25-hour DST days", () => {
    expect(localDay(new Date("2026-10-31T23:30:00Z"))).toBe("2026-11-01");
    expect(localDay(new Date("2026-07-31T21:59:00Z"))).toBe("2026-07-31");
    expect(localDay(new Date("2026-07-31T22:00:00Z"))).toBe("2026-08-01");
    expect(new Date(localMidnight("2026-11-01")).toISOString()).toBe("2026-10-31T23:00:00.000Z");
    expect(new Date(localMidnight("2026-08-01")).toISOString()).toBe("2026-07-31T22:00:00.000Z");
    expect(localMidnight("2026-10-26") - localMidnight("2026-10-25")).toBe(25 * 3600e3); // CEST → CET
    expect(localMidnight("2026-03-30") - localMidnight("2026-03-29")).toBe(23 * 3600e3); // CET → CEST
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(utcHourToLocalDay("2026-10-31T23")).toBe("2026-11-01");
    expect(utcHourToLocalDay("2026-07-31T21")).toBe("2026-07-31");
    expect(utcHourToLocalDay("2026-07-31 22")).toBe("2026-08-01");
    expect(utcHourToLocalDay("2026-07-31")).toBe("2026-07-31");
    expect(utcHourToLocalDay("garbage")).toBeNull();
  });

  it("the month flips at Prague midnight, not UTC midnight", () => {
    const d = days("2026-10-01", 31, 1);
    const before = forecastMonth(d, "2026-10-01", new Date("2026-10-31T22:59:00Z")); // 23:59 Prague, Oct 31
    expect(before.period).toBe("2026-10");
    expect(before.day_of_month).toBe(31);
    expect(before.days_remaining).toBeCloseTo(1 / 1440, 5); // one minute left
    const after = forecastMonth(d, "2026-10-01", new Date("2026-10-31T23:01:00Z")); // 00:01 Prague, Nov 1 (UTC still Oct 31)
    expect(after.period).toBe("2026-11");
    expect(after.day_of_month).toBe(1);
    expect(after.spent_usd).toBe(0);
  });

  it("days remaining on the 25-hour DST day", () => {
    // 2026-10-25 12:00 CET = 11:00Z; 13 of 25 hours gone; Oct has 31 days
    const f = forecastMonth(days("2026-10-01", 25, 1), "2026-10-01", new Date("2026-10-25T11:00:00Z"));
    expect(f.day_of_month).toBe(25);
    expect(f.days_remaining).toBeCloseTo(6 + 12 / 25, 6);
  });

  it("budget status buckets rows into Prague days; usage-summary uses the same forecast", async () => {
    const D = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    await pg.query('insert into neon_auth."user" (id, name, email) values ($1, \'D\', \'d@example.test\')', [D]);
    await pg.query("insert into subscriptions (user_id, stripe_customer_id, stripe_subscription_id, status, current_period_end) values ($1, 'cus_d', 'sub_d', 'active', now() + interval '400 days')", [D]);
    const ins = (id: string, at: string, cost: number) =>
      pg.query("insert into activity_rows (user_id, generation_id, created_at, cost_total, provider_source) values ($1, $2, $3, $4, 'openai')", [D, id, at, cost]);
    for (let i = 1; i <= 20; i++) await ins(`d-oct-${i}`, `2026-10-${String(i).padStart(2, "0")}T10:00:00.000Z`, 1);
    await ins("d-late", "2026-10-31T23:30:00.000Z", 7); // 00:30 Prague on Nov 1
    const now = new Date("2026-11-01T10:00:00Z");
    const s = await budgetStatus(db, D, null, now, 23.5);
    expect(s.period).toBe("2026-11");
    expect(s.tz).toBe("Europe/Prague");
    expect(s.total.forecast.spent_usd).toBeCloseTo(7, 6);
    expect(s.days).toEqual([{ date: "2026-11-01", cost_usd: 7 }]);
    const u = await usageSummary(db, D, true, "Europe/Prague", now);
    expect(u.month.cost_usd).toBeCloseTo(7, 6);
    expect(u.forecast_month_usd).toBeCloseTo(s.total.forecast.forecast_usd!, 4);
    expect(u.forecast?.confidence).toBe(s.total.forecast.confidence);
    expect(u.forecast?.method).toBe("weighted_run_rate");
  });
});
