// Run: cd supabase/functions/mcp && deno test --no-lock app.test.ts   (also run by scripts/check-functions.sh)
// Walks the request sequence a generic Streamable-HTTP MCP client (Grok Bot, Cursor, Claude Code …)
// sends with a static "Authorization: Bearer <token>" header.
import { createMcpApp } from "./app.ts";

const TOKEN = "tok_test_only";
const PRO_USER = "00000000-0000-0000-0000-0000000000aa";
const FREE_USER = "00000000-0000-0000-0000-0000000000bb";
const rpcCalls: unknown[] = [];

const app = createMcpApp({
  authUser: (req) => {
    const h = req.headers.get("authorization") ?? "";
    if (h === `Bearer ${TOKEN}`) return Promise.resolve(PRO_USER);
    if (h === "Bearer free") return Promise.resolve(FREE_USER);
    return Promise.resolve(null);
  },
  userIsPro: (id) => Promise.resolve(id === PRO_USER),
  db: () => ({
    rpc: (fn: string, args: unknown) => {
      rpcCalls.push({ fn, args });
      return Promise.resolve({
        data: [{ bucket: "all", cost_total: 1.23456, request_count: 7, row_count: 3, tokens_prompt: 0, tokens_completion: 0, tokens_reasoning: 0 }],
        error: null,
      });
    },
  }),
});

const URL_ = "https://tokeny.example/functions/v1/mcp";
function post(body: unknown, headers: Record<string, string> = {}) {
  return app.fetch(new Request(URL_, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${TOKEN}`,
      ...headers,
    },
    body: JSON.stringify(body),
  }));
}
// Responses may be JSON or a single SSE event, depending on Accept.
async function rpcResult(res: Response) {
  const text = await res.text();
  if ((res.headers.get("content-type") ?? "").includes("text/event-stream")) {
    const data = text.split("\n").find((l) => l.startsWith("data:"));
    return JSON.parse(data!.slice(5));
  }
  return JSON.parse(text);
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}
const init = (v: string) => ({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: v, capabilities: {}, clientInfo: { name: "test", version: "0" } } });

Deno.test("initialize negotiates 2025-06-18 and reports tools capability", async () => {
  const res = await post(init("2025-06-18"));
  assert(res.status === 200, `status ${res.status}`);
  const body = await rpcResult(res);
  assert(body.result.protocolVersion === "2025-06-18", JSON.stringify(body));
  assert(body.result.serverInfo.name === "tokeny", "server name");
  assert(body.result.capabilities.tools, "tools capability");
  assert(res.headers.get("access-control-allow-origin") === "*", "CORS");
});

Deno.test("initialize from a newer client falls back to a version we support", async () => {
  const body = await rpcResult(await post(init("2025-11-25")));
  assert(["2025-03-26", "2025-06-18"].includes(body.result.protocolVersion), JSON.stringify(body.result));
});

Deno.test("notifications/initialized is accepted with 202", async () => {
  const res = await post({ jsonrpc: "2.0", method: "notifications/initialized" }, { "mcp-protocol-version": "2025-06-18" });
  assert(res.status === 202, `status ${res.status}`);
  await res.body?.cancel();
});

Deno.test("tools/list returns all tools with schemas and annotations", async () => {
  const body = await rpcResult(await post({ jsonrpc: "2.0", id: 2, method: "tools/list" }, { "mcp-protocol-version": "2025-06-18" }));
  const tools = body.result.tools as { name: string; inputSchema: { type: string }; annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean } }[];
  const names = tools.map((t) => t.name).sort();
  assert(JSON.stringify(names) === JSON.stringify(["delete_all_data", "delete_request", "get_cost_by_model", "get_cost_by_provider", "get_total_cost", "list_models", "list_recent_requests"]), names.join());
  for (const t of tools) assert(t.inputSchema?.type === "object", `${t.name} schema`);
  assert(tools.find((t) => t.name === "get_total_cost")?.annotations?.readOnlyHint === true, "read-only hint");
  assert(tools.find((t) => t.name === "delete_all_data")?.annotations?.destructiveHint === true, "destructive hint");
});

Deno.test("tools/call runs scoped to the token's user (JSON and SSE responses)", async () => {
  const call = { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_total_cost", arguments: { from_date: "2026-10-01" } } };
  for (const accept of ["application/json", "application/json, text/event-stream"]) {
    rpcCalls.length = 0;
    const res = await post(call, { accept, "mcp-protocol-version": "2025-06-18" });
    assert(res.status === 200, `status ${res.status}`);
    const body = await rpcResult(res);
    const out = JSON.parse(body.result.content[0].text);
    assert(out.total_cost_usd === 1.2346 && out.requests === 7, JSON.stringify(out));
    const args = (rpcCalls[0] as { args: { p_user_id: string; p_from: string } }).args;
    assert(args.p_user_id === PRO_USER && args.p_from === "2026-10-01", JSON.stringify(args));
  }
});

Deno.test("GET and DELETE answer 405 (no server-initiated stream, no sessions)", async () => {
  for (const [method, headers] of [
    ["GET", { accept: "text/event-stream", "mcp-protocol-version": "2025-03-26" }],
    ["GET", { accept: "text/event-stream" }],
    ["DELETE", {}],
  ] as const) {
    const res = await app.fetch(new Request(URL_, { method, headers: { ...headers, authorization: `Bearer ${TOKEN}` } }));
    assert(res.status === 405, `${method} -> ${res.status}`);
    await res.body?.cancel();
  }
});

Deno.test("missing or wrong token: 401 with WWW-Authenticate", async () => {
  for (const auth of [undefined, "Bearer nope"]) {
    const res = await post(init("2025-06-18"), auth ? { authorization: auth } : { authorization: "" });
    assert(res.status === 401, `status ${res.status}`);
    assert((res.headers.get("www-authenticate") ?? "").startsWith("Bearer"), "WWW-Authenticate");
    await res.body?.cancel();
  }
});

Deno.test("free plan: 403 with the Pro-required body", async () => {
  const res = await post(init("2025-06-18"), { authorization: "Bearer free" });
  assert(res.status === 403, `status ${res.status}`);
  await res.body?.cancel();
});

Deno.test("CORS preflight works without a token", async () => {
  const res = await app.fetch(new Request(URL_, { method: "OPTIONS" }));
  assert(res.status === 204, `status ${res.status}`);
  assert((res.headers.get("access-control-allow-headers") ?? "").includes("mcp-protocol-version"), "allow headers");
});
