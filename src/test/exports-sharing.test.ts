// @vitest-environment node
// Exports (CSV/JSON + monthly report) and read-only share links, against PGlite with the real
// schema (db/schema.sql) and the real HTTP API (server/app.ts).
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Db } from "../../server/db";
import { createApp } from "../../server/app";
import { csvCell, toCsv } from "../../server/lib/csv";
import { hashShareToken, newShareToken, parseShareInput, resolvePeriod, SHARE_TOKEN_RE } from "../../server/lib/share-scope";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"; // free
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"; // Pro
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"; // Pro, used to test a lapsed owner
const users: Record<string, { id: string; email: string; name: string }> = {
  a: { id: A, email: "alice@example.test", name: "Alice Secret" },
  b: { id: B, email: "bob@example.test", name: "Bob Secret" },
  c: { id: C, email: "carol@example.test", name: "Carol Secret" },
};

let pg: PGlite;
let db: Db;
let app: ReturnType<typeof createApp>;
let ipSeq = 0;

function asDb(p: PGlite): Db {
  return {
    async query(text, params) {
      const r = await p.query(text, params as unknown[]);
      return { rows: r.rows as never[], rowCount: r.affectedRows ?? r.rows.length };
    },
  };
}

async function call(who: string | null, method: string, url: string, body?: unknown, ip = `10.0.0.${++ipSeq % 250}`) {
  const headers: Record<string, string> = { "content-type": "application/json", "x-real-ip": ip };
  if (who) headers["x-test-user"] = who;
  const res = await app.fetch(new Request(`https://tokeny.test${url}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }));
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* csv */ }
  return { status: res.status, json, text, headers: res.headers };
}

const pragueDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const today = pragueDay(new Date());
const noonUtc = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10) + "T10:00:00.000Z";

async function seed(user: string, gid: string, created: string, cost: number, provider: string, model: string) {
  await pg.query(
    `insert into activity_rows (user_id, generation_id, created_at, cost_total, model_permaslug, provider_name, tokens_prompt, tokens_completion, provider_source, api_key_name, app_name)
     values ($1,$2,$3,$4,$5,$6,100,50,$7,'my-secret-key-name','my-private-app')`,
    [user, gid, created, cost, model, provider, provider.toLowerCase()],
  );
}

beforeAll(async () => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  pg = new PGlite();
  await pg.exec(`
    create schema neon_auth;
    create table neon_auth."user" (id uuid primary key, name text, email text, "emailVerified" boolean default false,
      image text, "createdAt" timestamptz default now(), "updatedAt" timestamptz default now());
  `);
  const schema = readFileSync(path.resolve(__dirname, "../../db/schema.sql"), "utf8").replace(/CREATE EXTENSION[^;]*;/i, "");
  await pg.exec(schema);
  await pg.exec(schema); // idempotent (prod migrations re-run it)
  for (const u of Object.values(users)) await pg.query('insert into neon_auth."user" (id, name, email) values ($1, $2, $3)', [u.id, u.name, u.email]);
  db = asDb(pg);
  app = createApp({
    db: () => db,
    sessionUser: async (req) => {
      const u = users[req.headers.get("x-test-user") ?? ""];
      return u ? { ...u, image: null, emailVerified: true } : null;
    },
  });
  for (const [u, n] of [[B, "b"], [C, "c"]]) {
    await pg.query(
      `insert into subscriptions (user_id, stripe_customer_id, stripe_subscription_id, status, current_period_end) values ($1, $2, $3, 'active', now() + interval '30 days')`,
      [u, `cus_${n}`, `sub_${n}`],
    );
  }
  await seed(B, "b1", noonUtc(1), 1.5, "OpenRouter", "openai/gpt-x");
  await seed(B, "b2", noonUtc(1), 0.5, "OpenRouter", "=HYPERLINK(\"http://evil\")");
  await seed(B, "b3", noonUtc(2), 2, "Anthropic", "claude-x");
  await seed(A, "a1", noonUtc(1), 99, "OpenRouter", "openai/gpt-x");
  await seed(C, "c1", noonUtc(1), 3, "OpenRouter", "openai/gpt-x");
}, 60_000);

describe("CSV safety", () => {
  it("neutralises formula injection and quotes", () => {
    for (const bad of ["=1+1", "+1", "-1", "@SUM(A1)", "\tx", "\rx"]) expect(csvCell(bad).replace(/^"/, "").startsWith("'")).toBe(true);
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell(-1.5)).toBe("-1.5"); // numbers stay numbers
    expect(csvCell(null)).toBe("");
    const csv = toCsv(["x"], [["=cmd"]]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("\r\n");
  });
});

describe("share input validation", () => {
  const now = new Date("2026-10-31T12:00:00Z");
  it("accepts a valid scope and rejects bad ones", () => {
    const ok = parseShareInput({ label: "Tým\u0007", period: { type: "rolling", days: 30 }, providers: ["openrouter"], show_amounts: false, currency: "CZK" }, now);
    expect(ok.ok && ok.value.label).toBe("Tým");
    expect(ok.ok && ok.value.scope.show_amounts).toBe(false);
    const bad = (b: object) => { const r = parseShareInput(b, now); return r.ok === false ? r.error : "ok"; };
    expect(bad({ period: { type: "rolling", days: 3 } })).toBe("invalid_period");
    expect(bad({ period: { type: "range", from: "2020-01-01", to: "2026-01-01" } })).toBe("range_too_long");
    expect(bad({ providers: ["evil"] })).toBe("invalid_providers");
    expect(bad({ currency: "EUR" })).toBe("invalid_currency");
    expect(bad({ expires_at: "2026-10-01T00:00:00Z" })).toBe("expires_in_past");
    expect(bad({ expires_at: "2030-01-01T00:00:00Z" })).toBe("expires_too_far");
  });
  it("resolves periods in Prague days", () => {
    expect(resolvePeriod({ type: "rolling", days: 7 }, now)).toEqual({ from: "2026-10-25", to: "2026-10-31" });
    expect(resolvePeriod({ type: "month" }, now)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
  });
  it("tokens are 256-bit url-safe and hashed with SHA-256", () => {
    const t = newShareToken();
    expect(t).toMatch(SHARE_TOKEN_RE);
    expect(hashShareToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(newShareToken()).not.toBe(t);
  });
});

describe("Pro gating", () => {
  it("free users get 403 pro_required for export, report and new links; list works", async () => {
    expect((await call("a", "GET", `/api/export?from=${today}`)).json.error).toBe("pro_required");
    expect((await call("a", "GET", `/api/report?month=${today.slice(0, 7)}`)).json.error).toBe("pro_required");
    expect((await call("a", "POST", "/api/shares", {})).json.error).toBe("pro_required");
    expect((await call("a", "GET", "/api/shares")).status).toBe(200);
  });
  it("unauthenticated is 401", async () => {
    expect((await call(null, "GET", `/api/export?from=${today}`)).status).toBe(401);
    expect((await call(null, "GET", "/api/shares")).status).toBe(401);
  });
});

describe("exports", () => {
  it("CSV by day × provider × model, own rows only, injection-safe, no-store", async () => {
    const r = await call("b", "GET", `/api/export?from=${pragueDay(new Date(Date.now() - 10 * 86_400_000))}&to=${today}&group=day_provider_model&format=csv`);
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toContain("no-store");
    expect(r.headers.get("content-disposition")).toMatch(/attachment; filename="tokeny-day_provider_model-/);
    const lines = r.text.replace(/^\uFEFF/, "").trim().split("\r\n");
    expect(lines[0]).toBe("date,provider,model,requests,input_tokens,output_tokens,reasoning_tokens,cached_tokens,cost_usd");
    expect(lines).toHaveLength(4);
    expect(r.text).not.toContain("99"); // A's row
    expect(r.text).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(r.text).not.toMatch(/(^|,)=HYPERLINK/m);
  });
  it("JSON by provider in CZK carries the rate note and CZK column", async () => {
    const r = await call("b", "GET", `/api/export?from=${pragueDay(new Date(Date.now() - 10 * 86_400_000))}&group=provider&format=json&currency=CZK`);
    expect(r.status).toBe(200);
    expect(r.json.meta.currency).toBe("CZK");
    expect(r.json.meta.note).toMatch(/ČNB|CNB/);
    const or = r.json.rows.find((x: any) => x.provider === "openrouter");
    expect(or.cost_usd).toBeCloseTo(2);
    expect(or.cost_czk).toBeCloseTo(2 * r.json.meta.usd_czk, 1);
    expect(JSON.stringify(r.json)).not.toMatch(/bob@|Bob Secret|my-secret-key-name|my-private-app/);
  });
  it("validates parameters", async () => {
    expect((await call("b", "GET", "/api/export?from=nope")).status).toBe(400);
    expect((await call("b", "GET", "/api/export?from=2020-01-01&to=2026-01-01")).json.error).toBe("range_too_long");
    expect((await call("b", "GET", `/api/export?from=${today}&group=evil`)).status).toBe(400);
  });
  it("monthly report has totals and the previous month", async () => {
    const r = await call("b", "GET", `/api/report?month=${today.slice(0, 7)}`);
    expect(r.status).toBe(200);
    expect(r.json.tz).toBe("Europe/Prague");
    expect(r.json.previous.month).toMatch(/^\d{4}-\d{2}$/);
    expect(JSON.stringify(r.json)).not.toMatch(/bob@|Bob Secret|my-secret-key-name/);
    expect((await call("b", "GET", "/api/report?month=2026-13")).status).toBe(400);
  });
});

describe("share links", () => {
  let token = "";
  let id = "";
  it("creates a link, stores only the hash and shows the token once", async () => {
    const r = await call("b", "POST", "/api/shares", { label: "Team", period: { type: "rolling", days: 30 }, show_amounts: true, currency: "USD" });
    expect(r.status).toBe(200);
    token = r.json.token;
    id = r.json.share.id;
    expect(token).toMatch(SHARE_TOKEN_RE);
    const { rows } = await pg.query<{ token_hash: string; share_token: string | null }>("select token_hash, share_token from shared_dashboards where id = $1", [id]);
    expect(rows[0].token_hash).toBe(hashShareToken(token));
    expect(rows[0].share_token).toBeNull();
    expect(JSON.stringify(await pg.query("select * from shared_dashboards"))).not.toContain(token);
    const list = (await call("b", "GET", "/api/shares")).json.shares;
    expect(list.map((s: any) => s.id)).toEqual([id]);
    expect(JSON.stringify(list)).not.toMatch(/token/);
  });
  it("public payload: aggregates only, no PII, noindex + no-store", async () => {
    const r = await call(null, "GET", `/api/shared/${token}`);
    expect(r.status).toBe(200);
    expect(r.headers.get("x-robots-tag")).toContain("noindex");
    expect(r.headers.get("cache-control")).toContain("no-store");
    expect(r.headers.get("referrer-policy")).toBe("no-referrer");
    const s = JSON.stringify(r.json);
    for (const bad of [B, "bob@", "Bob Secret", "my-secret-key-name", "my-private-app", "user_id", "email", "generation_id", hashShareToken(token)]) expect(s).not.toContain(bad);
    expect(r.json.totals.cost_usd).toBeCloseTo(4);
    expect(r.json.daily).toHaveLength(30);
    expect(r.json.providers.reduce((a: number, p: any) => a + p.cost_pct, 0)).toBeCloseTo(100, 0);
    const { rows } = await pg.query<{ view_count: number }>("select view_count from shared_dashboards where id = $1", [id]);
    expect(rows[0].view_count).toBe(1);
  });
  it("show_amounts=false and a provider filter leave out every money value", async () => {
    const r = await call("b", "POST", "/api/shares", { period: { type: "month" }, providers: ["anthropic"], show_amounts: false });
    const pub = await call(null, "GET", `/api/shared/${r.json.token}`);
    expect(pub.status).toBe(200);
    expect(JSON.stringify(pub.json)).not.toMatch(/cost_usd|usd_czk|rate_date/);
    expect(pub.json.providers.map((p: any) => p.provider)).toEqual(["anthropic"]);
    expect(pub.json.providers[0].cost_pct).toBe(100);
  });
  it("A can neither see nor revoke B's links", async () => {
    expect((await call("a", "GET", "/api/shares")).json.shares).toEqual([]);
    expect((await call("a", "DELETE", `/api/shares/${id}`)).status).toBe(404);
    expect((await call(null, "GET", `/api/shared/${token}`)).status).toBe(200);
  });
  it("revoke → 410 revoked, and it disappears from the list", async () => {
    expect((await call("b", "DELETE", `/api/shares/${id}`)).status).toBe(200);
    const r = await call(null, "GET", `/api/shared/${token}`);
    expect(r.status).toBe(410);
    expect(r.json.error).toBe("revoked");
    expect((await call("b", "GET", "/api/shares")).json.shares.map((s: any) => s.id)).not.toContain(id);
  });
  it("expired → 410 expired; unknown or malformed → 404", async () => {
    const r = await call("b", "POST", "/api/shares", { expires_at: new Date(Date.now() + 86_400_000).toISOString() });
    await pg.query("update shared_dashboards set expires_at = now() - interval '1 minute' where id = $1", [r.json.share.id]);
    expect((await call(null, "GET", `/api/shared/${r.json.token}`)).json.error).toBe("expired");
    expect((await call(null, "GET", `/api/shared/${newShareToken()}`)).status).toBe(404);
    expect((await call(null, "GET", "/api/shared/short")).status).toBe(404);
  });
  it("a lapsed Pro owner → 410 inactive", async () => {
    const r = await call("c", "POST", "/api/shares", {});
    expect((await call(null, "GET", `/api/shared/${r.json.token}`)).status).toBe(200);
    await pg.query("update subscriptions set status = 'canceled', current_period_end = now() - interval '1 day' where user_id = $1", [C]);
    const g = await call(null, "GET", `/api/shared/${r.json.token}`);
    expect(g.status).toBe(410);
    expect(g.json.error).toBe("inactive");
    expect((await call("c", "GET", "/api/shares")).json.shares).toHaveLength(1); // can still list…
    expect((await call("c", "DELETE", `/api/shares/${r.json.share.id}`)).status).toBe(200); // …and revoke
  });
  it("rejects invalid input with 400", async () => {
    expect((await call("b", "POST", "/api/shares", { providers: ["nope"] })).json.error).toBe("invalid_providers");
  });
  it("rate-limits the public endpoint per client (429) without storing the IP", async () => {
    const ip = "203.0.113.7";
    let last = 0;
    for (let i = 0; i < 61; i++) last = (await call(null, "GET", "/api/shared/short", undefined, ip)).status;
    expect(last).toBe(429);
    expect((await call(null, "GET", "/api/shared/short", undefined, "203.0.113.8")).status).toBe(404);
    const { rows } = await pg.query<{ bucket: string }>("select bucket from rate_limits");
    expect(JSON.stringify(rows)).not.toContain("203.0.113");
  });
});
