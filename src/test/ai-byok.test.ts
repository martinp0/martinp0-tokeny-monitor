// @vitest-environment node
// AI features use the caller's OWN Anthropic key (BYOK). Real schema on PGlite + the real HTTP API,
// with Anthropic mocked: per-user key isolation, no key in responses or logs, clean 4xx errors.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Db } from "../../server/db";
import { createApp } from "../../server/app";
import * as repo from "../../server/repo";
import { decryptSecret } from "../../server/crypto";
import { classifyAnthropicError } from "../../server/ai";
import { validateAiKeyShape } from "../../server/lib/credential-keys";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"; // free
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"; // Pro
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"; // no key
const users: Record<string, { id: string; email: string; name: string }> = {
  a: { id: A, email: "a@example.test", name: "Alice" },
  b: { id: B, email: "b@example.test", name: "Bob" },
  c: { id: C, email: "c@example.test", name: "Cyril" },
};
const KEY_A = "sk-ant-api03-AAAAaaaaAAAAaaaaAAAAaaaa-alice-1111";
const KEY_B = "sk-ant-api03-BBBBbbbbBBBBbbbbBBBBbbbb-bobby-2222";
const SERVER_KEY = "sk-ant-api03-SERVERserverSERVERserver-shared-9999";

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

async function call(who: string | null, method: string, url: string, body?: unknown) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (who) headers["x-test-user"] = who;
  const res = await app.fetch(new Request(`https://tokeny.test${url}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }));
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text };
}

/** Mock Anthropic. `reply(key)` decides the response per request; records the keys used. */
function mockAnthropic(reply: (key: string, url: string) => Response | Promise<Response>) {
  const seen: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const key = String((init?.headers as Record<string, string>)?.["x-api-key"] ?? "");
    seen.push(key);
    return reply(key, String(url));
  }));
  return seen;
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const okText = (text: string) => json(200, { content: [{ type: "text", text }], stop_reason: "end_turn" });

let logged = "";
beforeAll(async () => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.ANTHROPIC_API_KEY = SERVER_KEY; // must be ignored
  pg = new PGlite();
  await pg.exec(`
    create schema neon_auth;
    create table neon_auth."user" (id uuid primary key, name text, email text, "emailVerified" boolean default false,
      image text, "createdAt" timestamptz default now(), "updatedAt" timestamptz default now());
  `);
  const schema = readFileSync(path.resolve(__dirname, "../../db/schema.sql"), "utf8").replace(/CREATE EXTENSION[^;]*;/i, "");
  await pg.exec(schema);
  for (const u of Object.values(users)) await pg.query('insert into neon_auth."user" (id, name, email) values ($1, $2, $3)', [u.id, u.name, u.email]);
  await pg.query(
    "insert into subscriptions (user_id, stripe_customer_id, stripe_subscription_id, status, current_period_end) values ($1, 'cus_b', 'sub_b', 'active', now() + interval '30 days')",
    [B],
  );
  db = asDb(pg);
  app = createApp({
    db: () => db,
    sessionUser: async (req) => {
      const u = users[req.headers.get("x-test-user") ?? ""];
      return u ? { ...u, image: null, emailVerified: true } : null;
    },
  });
  for (const level of ["error", "warn", "log", "info"] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => { logged += args.map(String).join(" ") + "\n"; });
  }
}, 60_000);

afterEach(() => vi.unstubAllGlobals());

describe("key validation (pure)", () => {
  it("accepts normal Anthropic API keys and rejects admin keys / junk", () => {
    expect(validateAiKeyShape("anthropic", KEY_A)).toBeNull();
    expect(validateAiKeyShape("anthropic", "sk-ant-admin01-xxxxxxxxxxxxxxxxxxxxxxxx")).toMatch(/Admin/);
    expect(validateAiKeyShape("anthropic", "sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxx")).toMatch(/sk-ant-/);
    expect(validateAiKeyShape("anthropic", "short")).not.toBeNull();
    expect(validateAiKeyShape("openai", KEY_A)).not.toBeNull();
  });
  it("classifies Anthropic errors", () => {
    expect(classifyAnthropicError(401, {})).toBe("ai_key_invalid");
    expect(classifyAnthropicError(403, {})).toBe("ai_key_invalid");
    expect(classifyAnthropicError(429, {})).toBe("ai_rate_limited");
    expect(classifyAnthropicError(400, { error: { message: "Your credit balance is too low" } })).toBe("ai_key_no_credit");
    expect(classifyAnthropicError(529, {})).toBe("ai_unavailable");
  });
});

describe("storing the user's own key", () => {
  it("requires auth", async () => {
    expect((await call(null, "GET", "/api/ai-key")).status).toBe(401);
    expect((await call(null, "PUT", "/api/ai-key", { api_key: KEY_A })).status).toBe(401);
  });

  it("starts empty and rejects bad shapes without calling Anthropic", async () => {
    const seen = mockAnthropic(() => json(200, {}));
    expect((await call("a", "GET", "/api/ai-key")).json).toEqual({ key: null });
    expect((await call("a", "PUT", "/api/ai-key", { api_key: "sk-ant-admin01-xxxxxxxxxxxxxxxxxxxxxxxx" })).status).toBe(400);
    expect((await call("a", "PUT", "/api/ai-key", { api_key: "nope" })).status).toBe(400);
    expect(seen).toEqual([]);
  });

  it("rejects a key Anthropic refuses and stores nothing", async () => {
    mockAnthropic(() => json(401, { error: { type: "authentication_error" } }));
    const r = await call("a", "PUT", "/api/ai-key", { api_key: KEY_A });
    expect(r.status).toBe(400);
    expect(r.json.code).toBe("ai_key_invalid");
    expect(r.text).not.toContain(KEY_A);
    expect((await call("a", "GET", "/api/ai-key")).json.key).toBeNull();
  });

  it("stores keys encrypted per user and only ever returns a masked preview", async () => {
    const seen = mockAnthropic(() => json(200, { data: [] }));
    const ra = await call("a", "PUT", "/api/ai-key", { api_key: KEY_A });
    const rb = await call("b", "PUT", "/api/ai-key", { api_key: KEY_B });
    expect(ra.status).toBe(200);
    expect(rb.status).toBe(200);
    expect(seen).toEqual([KEY_A, KEY_B]); // verification used exactly the submitted key
    expect(ra.json.key.key_preview).toBe("••••1111");
    expect(ra.json.verified).toBe(true);
    for (const r of [ra, rb, await call("a", "GET", "/api/ai-key"), await call("b", "GET", "/api/ai-key")]) {
      expect(r.text).not.toContain(KEY_A);
      expect(r.text).not.toContain(KEY_B);
      expect(r.text).not.toContain("ciphertext");
      expect(r.text).not.toMatch(/v1:/);
    }
    expect((await call("b", "GET", "/api/ai-key")).json.key.key_preview).toBe("••••2222");
    expect((await call("c", "GET", "/api/ai-key")).json.key).toBeNull();

    const { rows } = await pg.query<{ user_id: string; api_key_ciphertext: string }>("select user_id, api_key_ciphertext from ai_keys order by user_id");
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.api_key_ciphertext.startsWith("v1:")).toBe(true);
      expect(r.api_key_ciphertext).not.toContain("sk-ant-");
    }
    // A's ciphertext is bound to A: it does not open as B (copied rows are useless).
    const aCt = rows.find((r) => r.user_id === A)!.api_key_ciphertext;
    expect(decryptSecret(aCt, A)).toBe(KEY_A);
    expect(() => decryptSecret(aCt, B)).toThrow();
  });

  it("a ciphertext copied onto another user's row is treated as invalid, not decrypted", async () => {
    const { rows } = await pg.query<{ api_key_ciphertext: string }>("select api_key_ciphertext from ai_keys where user_id = $1", [A]);
    await pg.query("insert into ai_keys (user_id, provider, api_key_ciphertext) values ($1, 'anthropic', $2)", [C, rows[0].api_key_ciphertext]);
    const seen = mockAnthropic(() => okText("x"));
    const r = await call("c", "POST", "/api/fun-ai", { mode: "joke" });
    expect(r.status).toBe(422);
    expect(r.json.code).toBe("ai_key_invalid");
    expect(seen).toEqual([]);
    await pg.query("delete from ai_keys where user_id = $1", [C]);
  });
});

describe("AI endpoints use the caller's own key", () => {
  it("without a key: 428 ai_key_missing with a help link; the server env key is never used", async () => {
    const seen = mockAnthropic(() => okText("should not happen"));
    const r = await call("c", "POST", "/api/fun-ai", { mode: "joke" });
    expect(r.status).toBe(428);
    expect(r.json.code).toBe("ai_key_missing");
    expect(r.json.help_url).toBe("https://console.anthropic.com/settings/keys");
    expect(seen).toEqual([]);
  });

  it("fun-ai and chat-agent call Anthropic with exactly the caller's key", async () => {
    const seen = mockAnthropic(() => okText("Vtip"));
    const ra = await call("a", "POST", "/api/fun-ai", { mode: "joke" });
    expect(ra.status).toBe(200);
    expect(ra.json.joke).toBe("Vtip");
    const rb = await call("b", "POST", "/api/chat-agent", { messages: [{ role: "user", content: "Ahoj" }] });
    expect(rb.status).toBe(200);
    expect(rb.json.reply).toBe("Vtip");
    expect(seen).toEqual([KEY_A, KEY_B]);
    expect(seen).not.toContain(SERVER_KEY);
    expect((await call("a", "GET", "/api/ai-key")).json.key.last_used_at).not.toBeNull();
  });

  it("chat agent stays Pro-only even with an own key", async () => {
    const seen = mockAnthropic(() => okText("x"));
    expect((await call("a", "POST", "/api/chat-agent", { messages: [{ role: "user", content: "Ahoj" }] })).status).toBe(403);
    expect(seen).toEqual([]);
  });

  it("maps provider failures to clean errors without leaking the key", async () => {
    const cases: Array<[Response | Error, number, string]> = [
      [json(401, { error: { type: "authentication_error", message: "invalid x-api-key" } }), 422, "ai_key_invalid"],
      [json(400, { error: { type: "invalid_request_error", message: "Your credit balance is too low" } }), 402, "ai_key_no_credit"],
      [json(429, { error: { type: "rate_limit_error" } }), 429, "ai_rate_limited"],
      [json(529, { error: { type: "overloaded_error" } }), 502, "ai_unavailable"],
      [new Error("network down"), 502, "ai_unavailable"],
    ];
    for (const [resp, status, code] of cases) {
      mockAnthropic(() => { if (resp instanceof Error) throw resp; return resp.clone(); });
      for (const [who, url, body] of [["a", "/api/fun-ai", { mode: "image" }], ["b", "/api/chat-agent", { messages: [{ role: "user", content: "x" }] }]] as const) {
        const r = await call(who, "POST", url, body);
        expect(r.status, `${url} ${code}`).toBe(status);
        expect(r.json.code).toBe(code);
        expect(r.text).not.toContain(KEY_A);
        expect(r.text).not.toContain(KEY_B);
      }
    }
  });

  it("never writes a key to the logs", () => {
    expect(logged).not.toContain(KEY_A);
    expect(logged).not.toContain(KEY_B);
    expect(logged).not.toContain(SERVER_KEY);
    expect(logged).not.toContain("sk-ant-");
  });

  it("deleting the key (or the account) removes it", async () => {
    expect((await call("a", "DELETE", "/api/ai-key")).json).toEqual({ deleted: true });
    mockAnthropic(() => okText("x"));
    expect((await call("a", "POST", "/api/fun-ai", { mode: "joke" })).status).toBe(428);
    expect((await call("b", "GET", "/api/ai-key")).json.key).not.toBeNull(); // B unaffected
    await repo.deleteUserCascade(db, B);
    expect((await pg.query("select 1 from ai_keys where user_id = $1", [B])).rows).toHaveLength(0);
  });
});
