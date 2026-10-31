// @vitest-environment node
// AI features use the caller's OWN key (BYOK) for Anthropic, OpenAI or OpenRouter. Real schema on
// PGlite + the real HTTP API, with the providers mocked: per-user key isolation, provider choice,
// tool calling per provider, no key in responses or logs, clean 4xx errors. Chat is open to Free.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Db } from "../../server/db";
import { createApp } from "../../server/app";
import * as repo from "../../server/repo";
import { decryptSecret } from "../../server/crypto";
import { classifyProviderError } from "../../server/ai-providers";
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
const KEY_A_OAI = "sk-proj-AAAAaaaaAAAAaaaaAAAAaaaa-alice-3333";
const KEY_B = "sk-or-v1-BBBBbbbbBBBBbbbbBBBBbbbb-bobby-2222";
const SERVER_KEY = "sk-ant-api03-SERVERserverSERVERserver-shared-9999";
const ALL_KEYS = [KEY_A, KEY_A_OAI, KEY_B, SERVER_KEY];

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

interface Seen { url: string; key: string; body: any }
/** Mock all providers. `reply` decides the response per request; records url, key and body. */
function mockProviders(reply: (req: Seen) => Response | Promise<Response>) {
  const seen: Seen[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const h = (init?.headers ?? {}) as Record<string, string>;
    const key = String(h["x-api-key"] ?? (h.authorization ?? "").replace(/^Bearer /, ""));
    const req = { url: String(url), key, body: init?.body ? JSON.parse(String(init.body)) : null };
    seen.push(req);
    return reply(req);
  }));
  return seen;
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
/** A plain text answer in the format of whichever provider was called. */
const textFor = (req: Seen, text: string) =>
  req.url.includes("anthropic.com")
    ? json(200, { content: [{ type: "text", text }], stop_reason: "end_turn" })
    : json(200, { choices: [{ message: { role: "assistant", content: text } }] });
const leaks = (t: string) => ALL_KEYS.some((k) => t.includes(k)) || t.includes("ciphertext") || /v1:/.test(t);
const ask = { messages: [{ role: "user", content: "Ahoj" }] };

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
  it("accepts normal inference keys and rejects admin / wrong-provider keys", () => {
    expect(validateAiKeyShape("anthropic", KEY_A)).toBeNull();
    expect(validateAiKeyShape("anthropic", "sk-ant-admin01-xxxxxxxxxxxxxxxxxxxxxxxx")).toMatch(/Admin/);
    expect(validateAiKeyShape("anthropic", KEY_A_OAI)).toMatch(/sk-ant-/);
    expect(validateAiKeyShape("openai", KEY_A_OAI)).toBeNull();
    expect(validateAiKeyShape("openai", "sk-admin-xxxxxxxxxxxxxxxxxxxxxxxxxxxx")).toMatch(/Admin/);
    expect(validateAiKeyShape("openai", KEY_A)).not.toBeNull();
    expect(validateAiKeyShape("openai", KEY_B)).not.toBeNull();
    expect(validateAiKeyShape("openrouter", KEY_B)).toBeNull();
    expect(validateAiKeyShape("openrouter", KEY_A_OAI)).toMatch(/sk-or-/);
    expect(validateAiKeyShape("gemini", KEY_A)).not.toBeNull();
    expect(validateAiKeyShape("anthropic", "short")).not.toBeNull();
  });
  it("classifies provider errors", () => {
    expect(classifyProviderError("anthropic", 401, {})).toBe("ai_key_invalid");
    expect(classifyProviderError("anthropic", 403, {})).toBe("ai_key_invalid");
    expect(classifyProviderError("anthropic", 400, { error: { message: "Your credit balance is too low" } })).toBe("ai_key_no_credit");
    expect(classifyProviderError("anthropic", 404, { error: { type: "not_found_error", message: "model: x" } })).toBe("ai_model_unavailable");
    expect(classifyProviderError("openai", 429, { error: { code: "insufficient_quota" } })).toBe("ai_key_no_credit");
    expect(classifyProviderError("openai", 429, { error: { code: "rate_limit_exceeded" } })).toBe("ai_rate_limited");
    expect(classifyProviderError("openai", 400, { error: { message: "The model `nope` does not exist" } })).toBe("ai_model_unavailable");
    expect(classifyProviderError("openrouter", 402, {})).toBe("ai_key_no_credit");
    expect(classifyProviderError("openrouter", 403, {})).toBe("ai_key_no_credit");
    expect(classifyProviderError("openrouter", 529, {})).toBe("ai_unavailable");
  });
});

describe("storing the user's own keys", () => {
  it("requires auth", async () => {
    expect((await call(null, "GET", "/api/ai-key")).status).toBe(401);
    expect((await call(null, "PUT", "/api/ai-key", { api_key: KEY_A })).status).toBe(401);
    expect((await call(null, "PUT", "/api/ai-settings", { provider: "openai" })).status).toBe(401);
  });

  it("starts empty and rejects bad shapes without calling any provider", async () => {
    const seen = mockProviders(() => json(200, {}));
    const r = await call("a", "GET", "/api/ai-key");
    expect(r.json.keys).toEqual([]);
    expect(r.json.active).toBeNull();
    expect(r.json.providers.map((p: any) => p.id)).toEqual(["anthropic", "openai", "openrouter"]);
    for (const body of [
      { provider: "anthropic", api_key: "sk-ant-admin01-xxxxxxxxxxxxxxxxxxxxxxxx" },
      { provider: "openai", api_key: "sk-admin-xxxxxxxxxxxxxxxxxxxxxxxxxxxx" },
      { provider: "openrouter", api_key: KEY_A_OAI },
      { provider: "gemini", api_key: KEY_A },
      { api_key: "nope" },
    ]) {
      const x = await call("a", "PUT", "/api/ai-key", body);
      expect(x.status).toBe(400);
      expect(x.json.code).toBe("ai_key_shape");
    }
    expect(seen).toEqual([]);
  });

  it("rejects keys the provider refuses (free check) and stores nothing", async () => {
    const seen = mockProviders(() => json(401, { error: { message: "invalid key" } }));
    for (const [provider, key] of [["anthropic", KEY_A], ["openai", KEY_A_OAI], ["openrouter", KEY_B]]) {
      const r = await call("a", "PUT", "/api/ai-key", { provider, api_key: key });
      expect(r.status).toBe(400);
      expect(r.json.code).toBe("ai_key_invalid");
      expect(leaks(r.text)).toBe(false);
    }
    // only free metadata endpoints were used to check, never a paid completion
    for (const s of seen) expect(s.url).toMatch(/\/v1\/models|\/api\/v1\/keys?$/);
    expect((await call("a", "GET", "/api/ai-key")).json.keys).toEqual([]);
  });

  it("rejects an OpenRouter management key", async () => {
    mockProviders((req) => (req.url.endsWith("/api/v1/keys") ? json(200, { data: [] }) : json(200, { data: {} })));
    const r = await call("b", "PUT", "/api/ai-key", { provider: "openrouter", api_key: KEY_B });
    expect(r.status).toBe(400);
    expect(r.json.code).toBe("ai_key_management");
    expect((await call("b", "GET", "/api/ai-key")).json.keys).toEqual([]);
  });

  it("stores keys encrypted per user and provider, returns only masked previews", async () => {
    const seen = mockProviders((req) => (req.url.endsWith("/api/v1/keys") ? json(401, {}) : json(200, { data: [] })));
    const ra = await call("a", "PUT", "/api/ai-key", { provider: "anthropic", api_key: KEY_A });
    const ro = await call("a", "PUT", "/api/ai-key", { provider: "openai", api_key: KEY_A_OAI });
    const rb = await call("b", "PUT", "/api/ai-key", { provider: "openrouter", api_key: KEY_B });
    for (const r of [ra, ro, rb]) expect(r.status).toBe(200);
    expect(seen.map((s) => s.key)).toEqual([KEY_A, KEY_A_OAI, KEY_B, KEY_B]);
    expect(ra.json.key.key_preview).toBe("••••1111");
    expect(ra.json.verified).toBe(true);
    // the first key becomes active with the provider's cheap default model
    expect(ra.json.active).toEqual({ provider: "anthropic", model: "claude-haiku-5-5" });
    expect(ro.json.active.provider).toBe("anthropic");
    expect(rb.json.active).toEqual({ provider: "openrouter", model: "anthropic/claude-haiku-5.5" });
    const ga = await call("a", "GET", "/api/ai-key");
    const gb = await call("b", "GET", "/api/ai-key");
    for (const r of [ra, ro, rb, ga, gb]) expect(leaks(r.text)).toBe(false);
    expect(ga.json.keys.map((k: any) => [k.provider, k.key_preview])).toEqual([["anthropic", "••••1111"], ["openai", "••••3333"]]);
    expect(gb.json.keys.map((k: any) => k.provider)).toEqual(["openrouter"]);
    expect((await call("c", "GET", "/api/ai-key")).json.keys).toEqual([]);

    const { rows } = await pg.query<{ user_id: string; api_key_ciphertext: string }>("select user_id, api_key_ciphertext from ai_keys order by user_id, provider");
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      expect(r.api_key_ciphertext.startsWith("v1:")).toBe(true);
      expect(r.api_key_ciphertext).not.toMatch(/sk-/);
    }
    const aCt = rows.find((r) => r.user_id === A)!.api_key_ciphertext;
    expect(decryptSecret(aCt, A)).toBe(KEY_A);
    expect(() => decryptSecret(aCt, B)).toThrow();
  });

  it("lets the user pick the active provider and model, only for providers they have a key for", async () => {
    let r = await call("a", "PUT", "/api/ai-settings", { provider: "openai", model: "gpt-4.1-mini" });
    expect(r.status).toBe(200);
    expect(r.json.active).toEqual({ provider: "openai", model: "gpt-4.1-mini" });
    r = await call("a", "PUT", "/api/ai-settings", { provider: "openrouter", model: "x" });
    expect(r.status).toBe(400);
    expect(r.json.code).toBe("ai_key_missing");
    r = await call("a", "PUT", "/api/ai-settings", { provider: "openai", model: "bad model; drop table" });
    expect(r.status).toBe(400);
    expect((await call("c", "PUT", "/api/ai-settings", { provider: "anthropic" })).status).toBe(400);
    expect((await call("a", "GET", "/api/ai-key")).json.active).toEqual({ provider: "openai", model: "gpt-4.1-mini" });
  });

  it("a ciphertext copied onto another user's row is treated as invalid, not decrypted", async () => {
    const { rows } = await pg.query<{ api_key_ciphertext: string }>("select api_key_ciphertext from ai_keys where user_id = $1 and provider = 'anthropic'", [A]);
    await pg.query("insert into ai_keys (user_id, provider, api_key_ciphertext) values ($1, 'anthropic', $2)", [C, rows[0].api_key_ciphertext]);
    const seen = mockProviders((req) => textFor(req, "x"));
    const r = await call("c", "POST", "/api/fun-ai", { mode: "joke" });
    expect(r.status).toBe(422);
    expect(r.json.code).toBe("ai_key_invalid");
    expect(seen).toEqual([]);
    await pg.query("delete from ai_keys where user_id = $1", [C]);
  });
});

describe("AI endpoints use the caller's own key and chosen provider", () => {
  it("without a key: 428 ai_key_missing; the server env key is never used", async () => {
    const seen = mockProviders((req) => textFor(req, "should not happen"));
    for (const [url, body] of [["/api/fun-ai", { mode: "joke" }], ["/api/chat-agent", ask]] as const) {
      const r = await call("c", "POST", url, body);
      expect(r.status).toBe(428);
      expect(r.json.code).toBe("ai_key_missing");
      expect(r.json.help_url).toBe("/settings#ai-key");
    }
    expect(seen).toEqual([]);
  });

  it("calls the active provider with exactly the caller's key and model", async () => {
    const seen = mockProviders((req) => textFor(req, "Vtip"));
    const ra = await call("a", "POST", "/api/fun-ai", { mode: "joke" }); // A: OpenAI gpt-4.1-mini
    const rb = await call("b", "POST", "/api/fun-ai", { mode: "joke" }); // B: OpenRouter default
    await call("a", "PUT", "/api/ai-settings", { provider: "anthropic" });
    const ra2 = await call("a", "POST", "/api/fun-ai", { mode: "joke" });
    for (const r of [ra, rb, ra2]) expect(r.json.joke).toBe("Vtip");
    expect(seen.map((s) => [new URL(s.url).host, s.key, s.body.model])).toEqual([
      ["api.openai.com", KEY_A_OAI, "gpt-4.1-mini"],
      ["openrouter.ai", KEY_B, "anthropic/claude-haiku-5.5"],
      ["api.anthropic.com", KEY_A, "claude-haiku-5-5"],
    ]);
    expect(seen.map((s) => s.key)).not.toContain(SERVER_KEY);
    const keys = (await call("a", "GET", "/api/ai-key")).json.keys;
    expect(keys.every((k: any) => k.last_used_at !== null)).toBe(true);
  });

  it("the chat assistant is open to Free users (own key, no Pro gate)", async () => {
    mockProviders((req) => textFor(req, "Ahoj!"));
    const r = await call("a", "POST", "/api/chat-agent", ask);
    expect(r.status).toBe(200);
    expect(r.json.reply).toBe("Ahoj!");
  });

  it("tool calling works with Anthropic (tool_use → tool_result)", async () => {
    await call("a", "PUT", "/api/ai-settings", { provider: "anthropic" });
    let n = 0;
    const seen = mockProviders(() =>
      n++ === 0
        ? json(200, { content: [{ type: "tool_use", id: "tu_1", name: "set_currency", input: { currency: "CZK" } }], stop_reason: "tool_use" })
        : json(200, { content: [{ type: "text", text: "Hotovo" }], stop_reason: "end_turn" }),
    );
    const r = await call("a", "POST", "/api/chat-agent", ask);
    expect(r.json).toEqual({ reply: "Hotovo", ui_actions: [{ name: "set_currency", args: { currency: "CZK" } }] });
    expect(seen[0].body.tools[0]).toHaveProperty("input_schema");
    const last = seen[1].body.messages.at(-1);
    expect(last.content[0]).toMatchObject({ type: "tool_result", tool_use_id: "tu_1" });
  });

  for (const [provider, who, host] of [["openai", "a", "api.openai.com"], ["openrouter", "b", "openrouter.ai"]] as const) {
    it(`tool calling works with ${provider} (tool_calls → role tool)`, async () => {
      if (provider === "openai") await call("a", "PUT", "/api/ai-settings", { provider: "openai" });
      let n = 0;
      const seen = mockProviders(() =>
        n++ === 0
          ? json(200, { choices: [{ message: { role: "assistant", content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "query_stats", arguments: '{"group_by":"model"}' } }, { id: "call_2", type: "function", function: { name: "export_data", arguments: '{"format":"pdf"}' } }] } }] })
          : json(200, { choices: [{ message: { role: "assistant", content: "Žádná data." } }] }),
      );
      const r = await call(who, "POST", "/api/chat-agent", ask);
      expect(r.status).toBe(200);
      expect(r.json).toEqual({ reply: "Žádná data.", ui_actions: [{ name: "export_data", args: { format: "pdf" } }] });
      expect(new URL(seen[0].url).host).toBe(host);
      expect(seen[0].body.messages[0].role).toBe("system");
      expect(seen[0].body.tools[0]).toMatchObject({ type: "function", function: { name: "query_stats" } });
      const msgs = seen[1].body.messages;
      expect(msgs.at(-3).tool_calls.map((c: any) => c.id)).toEqual(["call_1", "call_2"]);
      expect(msgs.at(-2)).toMatchObject({ role: "tool", tool_call_id: "call_1" });
      expect(JSON.parse(msgs.at(-2).content)).toMatchObject({ count: 0 }); // B has no rows; only B's data is read
      expect(msgs.at(-1)).toMatchObject({ role: "tool", tool_call_id: "call_2" });
    });
  }

  it("retries an OpenAI model that does not take reasoning_effort", async () => {
    const seen = mockProviders((req) =>
      "reasoning_effort" in req.body
        ? json(400, { error: { message: "Unsupported parameter: 'reasoning_effort' is not supported with this model." } })
        : textFor(req, "ok"),
    );
    const r = await call("a", "POST", "/api/fun-ai", { mode: "joke" });
    expect(r.status).toBe(200);
    expect(seen).toHaveLength(2);
  });

  it("maps provider failures to clean errors without leaking keys", async () => {
    const cases: Array<[() => Response, number, string]> = [
      [() => json(401, { error: { message: "Incorrect API key provided: sk-proj-***3333" } }), 422, "ai_key_invalid"],
      [() => json(402, { error: { code: 402, message: "Insufficient credits" } }), 402, "ai_key_no_credit"],
      [() => json(429, { error: { code: "insufficient_quota" } }), 402, "ai_key_no_credit"],
      [() => json(429, { error: { code: "rate_limit_exceeded" } }), 429, "ai_rate_limited"],
      [() => json(404, { error: { message: "model not found" } }), 422, "ai_model_unavailable"],
      [() => json(200, { error: { code: 402, message: "upstream: no credits" } }), 402, "ai_key_no_credit"],
      [() => json(529, { error: { type: "overloaded_error" } }), 502, "ai_unavailable"],
      [() => { throw new Error("network down"); }, 502, "ai_unavailable"],
    ];
    for (const [resp, status, code] of cases) {
      mockProviders(resp);
      for (const [who, url, body] of [["a", "/api/fun-ai", { mode: "image" }], ["b", "/api/chat-agent", ask]] as const) {
        const r = await call(who, "POST", url, body);
        expect(r.status, `${url} ${code}`).toBe(status);
        expect(r.json.code).toBe(code);
        expect(r.json.provider).toBe(who === "a" ? "openai" : "openrouter");
        if (code === "ai_key_no_credit") expect(r.json.help_url).toMatch(/billing|credits/);
        expect(leaks(r.text)).toBe(false);
      }
    }
  });

  it("lists models for the picker (OpenRouter list is public: no key sent)", async () => {
    const seen = mockProviders(() =>
      json(200, { data: [{ id: "openai/gpt-6-luna", supported_parameters: ["tools"] }, { id: "x/no-tools", supported_parameters: [] }] }),
    );
    const r = await call("b", "GET", "/api/ai-models?provider=openrouter");
    expect(r.json.models).toEqual(["openai/gpt-6-luna"]);
    expect(seen[0].key).toBe("");
    const c = await call("c", "GET", "/api/ai-models?provider=openai");
    expect(c.json.models).toBeNull();
    expect(c.json.suggested.length).toBeGreaterThan(0);
  });

  it("never writes a key to the logs", () => {
    for (const k of ALL_KEYS) expect(logged).not.toContain(k);
    expect(logged).not.toMatch(/sk-(ant|or|proj)-/);
  });

  it("deleting a key falls back to the user's other key; deleting the account removes all", async () => {
    await call("a", "PUT", "/api/ai-settings", { provider: "openai" });
    const r = await call("a", "DELETE", "/api/ai-key?provider=openai");
    expect(r.json.deleted).toBe(true);
    expect(r.json.active).toEqual({ provider: "anthropic", model: "claude-haiku-5-5" });
    expect((await call("a", "DELETE", "/api/ai-key?provider=anthropic")).json.active).toBeNull();
    mockProviders((req) => textFor(req, "x"));
    expect((await call("a", "POST", "/api/fun-ai", { mode: "joke" })).status).toBe(428);
    expect((await call("b", "GET", "/api/ai-key")).json.keys).toHaveLength(1); // B unaffected
    await repo.deleteUserCascade(db, B);
    expect((await pg.query("select 1 from ai_keys where user_id = $1", [B])).rows).toHaveLength(0);
    expect((await pg.query("select 1 from ai_settings where user_id = $1", [B])).rows).toHaveLength(0);
  });
});
