// @vitest-environment node
// Tenant isolation against a real Postgres (PGlite, in-process): the same schema as Neon
// (db/schema.sql) and the real HTTP API (server/app.ts). Two users; every route must only ever
// read or change the caller's own rows.
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Db } from "../../server/db";
import { createApp } from "../../server/app";
import * as repo from "../../server/repo";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const users: Record<string, { id: string; email: string; name: string }> = {
  a: { id: A, email: "a@example.test", name: "Alice" },
  b: { id: B, email: "b@example.test", name: "Bob" },
};

let pg: PGlite;
let db: Db;
let app: ReturnType<typeof createApp>;

function asDb(p: PGlite): Db {
  return {
    async query(text, params) {
      const r = await p.query(text, params as unknown[]);
      return { rows: r.rows as never[], rowCount: r.affectedRows ?? r.rows.length };
    },
  };
}

async function call(who: "a" | "b" | null, method: string, url: string, body?: unknown) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (who) headers["x-test-user"] = who;
  const res = await app.fetch(new Request(`https://tokeny.test${url}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  }));
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text };
}

const row = (gid: string, cost: number, created = new Date().toISOString()) => ({
  generation_id: gid, created_at: created, cost_total: cost, model_permaslug: "openai/gpt-x", provider_name: "OpenAI",
  tokens_prompt: 10, tokens_completion: 5, provider_source: "openrouter",
});

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
  for (const u of Object.values(users)) await pg.query('insert into neon_auth."user" (id, name, email) values ($1, $2, $3)', [u.id, u.name, u.email]);
  db = asDb(pg);
  app = createApp({
    db: () => db,
    sessionUser: async (req) => {
      const u = users[req.headers.get("x-test-user") ?? ""];
      return u ? { ...u, image: null, emailVerified: true } : null;
    },
  });
  // B is Pro so B can create shares, tokens, alerts; A stays free.
  await pg.query(
    "insert into subscriptions (user_id, stripe_customer_id, stripe_subscription_id, status, current_period_end) values ($1, 'cus_b', 'sub_b', 'active', now() + interval '30 days')",
    [B],
  );
}, 60_000);

describe("unauthenticated", () => {
  it("rejects private routes with 401", async () => {
    for (const [m, u] of [["GET", "/api/me"], ["GET", "/api/activity"], ["POST", "/api/activity/import"], ["GET", "/api/credentials"], ["POST", "/api/account/delete"], ["GET", "/api/usage-summary"]]) {
      expect((await call(null, m, u, m === "GET" ? undefined : {})).status, `${m} ${u}`).toBe(401);
    }
  });
  it("MCP: POST without token → 401 with WWW-Authenticate, GET → 405", async () => {
    const res = await app.fetch(new Request("https://tokeny.test/api/mcp", { method: "POST", body: "{}", headers: { "content-type": "application/json" } }));
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("Bearer");
    expect((await app.fetch(new Request("https://tokeny.test/api/mcp"))).status).toBe(405);
  });
  it("cron requires the secret", async () => {
    expect((await call(null, "GET", "/api/cron/daily")).status).toBe(401);
  });
});

describe("activity rows", () => {
  it("each user sees only their own rows, even with the same generation_id", async () => {
    expect((await call("a", "POST", "/api/activity/import", { rows: [row("g1", 1), row("g2", 2)] })).json.written).toBe(2);
    // B imports the same generation id and tries to smuggle A's user id in the payload.
    expect((await call("b", "POST", "/api/activity/import", { rows: [{ ...row("g1", 100), user_id: A }] })).json.written).toBe(1);
    const a = (await call("a", "GET", "/api/activity")).json.rows;
    const b = (await call("b", "GET", "/api/activity")).json.rows;
    expect(a.map((r: any) => r.generation_id).sort()).toEqual(["g1", "g2"]);
    expect(a.find((r: any) => r.generation_id === "g1").cost_total).toBe(1);
    expect(b.map((r: any) => r.generation_id)).toEqual(["g1"]);
    expect(b[0].cost_total).toBe(100);
    expect(b[0]).not.toHaveProperty("user_id");
  });
  it("ignoreDuplicates keeps existing rows; upsert overwrites only own rows", async () => {
    expect((await call("a", "POST", "/api/activity/import", { rows: [row("g1", 5)], ignoreDuplicates: true })).json.written).toBe(0);
    await call("a", "POST", "/api/activity/import", { rows: [row("g1", 7)] });
    const { rows } = await db.query("select user_id, cost_total from activity_rows where generation_id = 'g1' order by cost_total");
    expect(rows).toEqual([{ user_id: A, cost_total: 7 }, { user_id: B, cost_total: 100 }]);
  });
  it("free users only see the last 30 days; Pro sees everything", async () => {
    const old = new Date(Date.now() - 60 * 86_400_000).toISOString();
    await call("a", "POST", "/api/activity/import", { rows: [row("old-a", 3, old)] });
    await call("b", "POST", "/api/activity/import", { rows: [row("old-b", 3, old)] });
    expect((await call("a", "GET", "/api/activity")).json.rows.map((r: any) => r.generation_id)).not.toContain("old-a");
    expect((await call("b", "GET", "/api/activity")).json.rows.map((r: any) => r.generation_id)).toContain("old-b");
  });
  it("aggregates are per user", async () => {
    const [a] = await repo.aggregateActivity(db, A, { groupBy: "none" });
    const [b] = await repo.aggregateActivity(db, B, { groupBy: "none" });
    expect(a.cost_total).toBe(7 + 2 + 3);
    expect(b.cost_total).toBe(100 + 3);
  });
});

describe("credentials", () => {
  let aCred: string;
  it("are stored encrypted and listed per user without key material", async () => {
    const r = await call("a", "POST", "/api/credentials", { provider: "openrouter", api_key: "sk-or-v1-aaaaaaaaaaaaaaaaaaaa1234" });
    expect(r.status).toBe(200);
    aCred = r.json.credential.id;
    expect(r.json.credential.key_preview).toBe("••••1234");
    expect(JSON.stringify(r.json)).not.toContain("aaaaaaaa");
    const { rows } = await db.query("select api_key_ciphertext from provider_credentials where id = $1", [aCred]);
    expect(rows[0].api_key_ciphertext).not.toContain("sk-or");
    expect((await call("b", "GET", "/api/credentials")).json.credentials).toEqual([]);
    expect((await call("a", "GET", "/api/credentials")).json.credentials).toHaveLength(1);
  });
  it("free plan: a second provider needs Pro, rotating the same one is fine", async () => {
    expect((await call("a", "POST", "/api/credentials", { provider: "anthropic", api_key: "sk-ant-admin01-xxxxxxxxxxxx" })).status).toBe(403);
    expect((await call("a", "POST", "/api/credentials", { provider: "openrouter", api_key: "sk-or-v1-bbbbbbbbbbbbbbbbbbbb5678" })).status).toBe(200);
  });
  it("another user cannot sync, disable or delete it", async () => {
    expect((await call("b", "POST", `/api/credentials/${aCred}/sync`, {})).status).toBe(404);
    expect((await call("b", "PATCH", `/api/credentials/${aCred}`, { enabled: false })).status).toBe(404);
    expect((await call("b", "DELETE", `/api/credentials/${aCred}`)).status).toBe(404);
    expect((await call("a", "GET", "/api/credentials")).json.credentials[0].enabled).toBe(true);
  });
  it("ciphertext is bound to its owner", async () => {
    const cred = await repo.credentialForSync(db, A, aCred);
    expect(repo.decryptCredential(cred!)).toBe("sk-or-v1-bbbbbbbbbbbbbbbbbbbb5678");
    expect(() => repo.decryptCredential({ ...cred!, user_id: B })).toThrow();
    expect(await repo.credentialForSync(db, B, aCred)).toBeNull();
  });
});

describe("shares, tokens, budget alerts", () => {
  it("Pro gates hold for the free user", async () => {
    expect((await call("a", "POST", "/api/shares", { label: "x" })).json.error).toBe("pro_required");
    expect((await call("a", "POST", "/api/mcp-tokens", { name: "x" })).status).toBe(403);
    expect((await call("a", "PUT", "/api/budget-alert", { monthly_budget_usd: 10 })).status).toBe(403);
    // the AI assistant is open to every plan (own key): without a key it is 428, not a Pro 403
    expect((await call("a", "POST", "/api/chat-agent", { messages: [] })).status).toBe(428);
  });
  it("B's share is public by token, but invisible and undeletable for A", async () => {
    expect((await call("b", "GET", "/api/me")).json.profile.display_name).toBe("Bob"); // profile is created lazily
    const created = (await call("b", "POST", "/api/shares", { label: "B board" })).json;
    const s = created.share;
    expect((await call("a", "GET", "/api/shares")).json.shares).toEqual([]);
    expect((await call("a", "DELETE", `/api/shares/${s.id}`)).status).toBe(404);
    const pub = await call(null, "GET", `/api/shared/${created.token}`);
    expect(pub.status).toBe(200);
    expect(pub.json.owner).toBeUndefined();
    expect(pub.json.rows).toBeUndefined(); // aggregates only, never raw rows
    expect(JSON.stringify(pub.json)).not.toContain(B);
    expect(JSON.stringify(pub.json)).not.toContain("Bob");
    expect((await call(null, "GET", "/api/og-dashboard?token=x")).status).not.toBe(200); // OG endpoint removed
    expect((await call(null, "GET", "/api/shared/doesnotexist123")).status).toBe(404);
  });
  it("B's personal token authenticates as B only (MCP + usage-summary)", async () => {
    const t = (await call("b", "POST", "/api/mcp-tokens", { name: "cli" })).json;
    expect(t.token).toMatch(/^orm_[0-9a-f]{64}$/);
    const { rows } = await db.query("select token_hash from mcp_tokens");
    expect(rows.map((r) => r.token_hash)).not.toContain(t.token);
    const res = await app.fetch(new Request("https://tokeny.test/api/usage-summary", { headers: { authorization: `Bearer ${t.token}` } }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.plan).toBe("pro");
    expect(body.month.cost_usd).toBe(100);
    const mcp = await app.fetch(new Request("https://tokeny.test/api/mcp", {
      method: "POST",
      headers: { authorization: `Bearer ${t.token}`, "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_total_cost", arguments: {} } }),
    }));
    const mtext = await mcp.text();
    expect(mcp.status).toBe(200);
    expect(mtext).toContain("103");
    expect((await call("a", "GET", "/api/mcp-tokens")).json.tokens).toEqual([]);
    expect((await call("a", "DELETE", `/api/mcp-tokens/${(await repo.listMcpTokens(db, B))[0].id}`)).status).toBe(404);
  });
  it("budget alerts are per user", async () => {
    expect((await call("b", "PUT", "/api/budget-alert", { monthly_budget_usd: 50, threshold_pct: 80 })).status).toBe(200);
    expect((await call("a", "GET", "/api/budget-alert")).json.alert).toBeNull();
    await call("a", "DELETE", "/api/budget-alert");
    expect((await call("b", "GET", "/api/budget-alert")).json.alert.monthly_budget_usd).toBe(50);
  });
});

describe("account deletion", () => {
  it("deletes only the caller and everything they own", async () => {
    const before = (await call("b", "GET", "/api/activity")).json.rows.length;
    const r = await call("a", "POST", "/api/account/delete", {});
    expect(r.status).toBe(200);
    for (const t of ["activity_rows", "provider_credentials", "profiles", "budget_alerts", "mcp_tokens", "shared_dashboards"]) {
      const { rows } = await db.query(`select count(*)::int as n from ${t} where user_id = $1`, [A]);
      expect(rows[0].n, t).toBe(0);
    }
    expect((await db.query('select id from neon_auth."user"')).rows.map((x) => x.id)).toEqual([B]);
    expect((await call("b", "GET", "/api/activity")).json.rows.length).toBe(before);
  });
  it("rejects cross-origin cookie writes", async () => {
    const res = await app.fetch(new Request("https://tokeny.test/api/activity", { method: "DELETE", headers: { "x-test-user": "b", origin: "https://evil.example" } }));
    expect(res.status).toBe(403);
  });
});
