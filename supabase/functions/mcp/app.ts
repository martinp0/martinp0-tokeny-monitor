import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import { AsyncLocalStorage } from "node:async_hooks";
import { proRequiredBody } from "../_shared/plan.ts";

// Minimal surface of the Supabase client the tools use (so tests can pass a fake).
// deno-lint-ignore no-explicit-any
export type Db = any;

export interface McpDeps {
  /** Resolves the Bearer token to a user id, or null. */
  authUser(req: Request): Promise<string | null>;
  /** MCP is a Pro feature; checked on every request so a lapsed subscription stops access. */
  userIsPro(userId: string): Promise<boolean>;
  /** Service-role client; queries are always scoped to the caller's user id. */
  db(): Db;
}

export const SERVER_INFO = { name: "tokeny", version: "1.2.0" };

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, mcp-session-id, mcp-protocol-version",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version, www-authenticate",
};

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false };

export function createMcpApp(deps: McpDeps) {
  // AsyncLocalStorage so tool handlers can read the caller's user_id without changing
  // mcp-lite's handler signature.
  const userCtx = new AsyncLocalStorage<string>();
  function currentUserId(): string {
    const id = userCtx.getStore();
    if (!id) throw new Error("Unauthorized: no user context");
    return id;
  }

  type AggRow = {
    bucket: string;
    cost_total: number;
    request_count: number;
    row_count: number;
    tokens_prompt: number;
    tokens_completion: number;
    tokens_reasoning: number;
  };

  // SQL-side aggregation (public.activity_aggregate) – never truncated by PostgREST max-rows.
  async function aggregate(userId: string, groupBy: string, from?: string, to?: string): Promise<AggRow[]> {
    const { data, error } = await deps.db().rpc("activity_aggregate", {
      p_user_id: userId,
      p_from: from || null,
      p_to: to || null,
      p_group_by: groupBy,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as AggRow[];
  }

  const text = (v: unknown) => ({ content: [{ type: "text" as const, text: typeof v === "string" ? v : JSON.stringify(v, null, 2) }] });

  const mcp = new McpServer(SERVER_INFO);

  mcp.tool("get_total_cost", {
    description: "Total cost (USD), request and row count for a period. Dates YYYY-MM-DD, both optional. / Celkové náklady (USD) v daném období.",
    annotations: READ_ONLY,
    inputSchema: {
      type: "object",
      properties: {
        from_date: { type: "string" },
        to_date: { type: "string" },
      },
    },
    handler: async ({ from_date, to_date }: any) => {
      const [row] = await aggregate(currentUserId(), "none", from_date, to_date);
      return text({
        total_cost_usd: +(row?.cost_total ?? 0).toFixed(4),
        requests: Number(row?.request_count ?? 0),
        rows: Number(row?.row_count ?? 0),
      });
    },
  });

  mcp.tool("get_cost_by_model", {
    description: "Cost per model, highest first. Dates YYYY-MM-DD, optional limit (default 20). / Náklady podle modelu, sestupně.",
    annotations: READ_ONLY,
    inputSchema: {
      type: "object",
      properties: { from_date: { type: "string" }, to_date: { type: "string" }, limit: { type: "number" } },
    },
    handler: async ({ from_date, to_date, limit = 20 }: any) => {
      const rows = await aggregate(currentUserId(), "model", from_date, to_date);
      const out = rows
        .map((r) => ({
          model: r.bucket,
          cost_usd: +Number(r.cost_total).toFixed(4),
          tokens: Number(r.tokens_prompt) + Number(r.tokens_completion) + Number(r.tokens_reasoning),
          requests: Number(r.request_count),
        }))
        .sort((a, b) => b.cost_usd - a.cost_usd)
        .slice(0, Math.max(1, Math.min(Number(limit) || 20, 200)));
      return text(out);
    },
  });

  mcp.tool("get_cost_by_provider", {
    description: "Cost per provider (OpenRouter, Anthropic, OpenAI …), highest first. / Náklady podle providera.",
    annotations: READ_ONLY,
    inputSchema: { type: "object", properties: { from_date: { type: "string" }, to_date: { type: "string" } } },
    handler: async ({ from_date, to_date }: any) => {
      const rows = await aggregate(currentUserId(), "provider", from_date, to_date);
      const out = rows
        .map((r) => ({ provider: r.bucket, cost_usd: +Number(r.cost_total).toFixed(4), requests: Number(r.request_count) }))
        .sort((a, b) => b.cost_usd - a.cost_usd);
      return text(out);
    },
  });

  mcp.tool("list_recent_requests", {
    description: "The last N requests (default 20, max 100) with model, provider, tokens and cost. / Posledních N requestů.",
    annotations: READ_ONLY,
    inputSchema: { type: "object", properties: { limit: { type: "number" } } },
    handler: async ({ limit = 20 }: any) => {
      const userId = currentUserId();
      const { data, error } = await deps.db()
        .from("activity_rows")
        .select("generation_id, created_at, model_permaslug, provider_name, provider_source, cost_total, tokens_prompt, tokens_completion, tokens_reasoning, request_count, app_name")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(Math.max(1, Math.min(Number(limit) || 20, 100)));
      if (error) throw new Error(error.message);
      return text(data ?? []);
    },
  });

  mcp.tool("list_models", {
    description: "All models and providers that appear in your data. / Seznam známých modelů a providerů.",
    annotations: READ_ONLY,
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const userId = currentUserId();
      const [models, providers] = await Promise.all([aggregate(userId, "model"), aggregate(userId, "provider")]);
      return text({ models: models.map((r) => r.bucket), providers: providers.map((r) => r.bucket) });
    },
  });

  mcp.tool("delete_request", {
    description: "Deletes one of your rows by generation_id (write). / Smaže vlastní záznam podle generation_id.",
    annotations: DESTRUCTIVE,
    inputSchema: { type: "object", properties: { generation_id: { type: "string" } }, required: ["generation_id"] },
    handler: async ({ generation_id }: any) => {
      const userId = currentUserId();
      const { error } = await deps.db().from("activity_rows").delete().eq("generation_id", generation_id).eq("user_id", userId);
      return { content: [{ type: "text", text: error ? `Error: ${error.message}` : `Deleted ${generation_id}` }] };
    },
  });

  mcp.tool("delete_all_data", {
    description: "DANGER: deletes ALL your usage data. Requires confirm=true. / POZOR: smaže VŠECHNA vaše data, vyžaduje confirm=true.",
    annotations: DESTRUCTIVE,
    inputSchema: { type: "object", properties: { confirm: { type: "boolean" } }, required: ["confirm"] },
    handler: async ({ confirm }: any) => {
      if (!confirm) return { content: [{ type: "text", text: "Operace zrušena – chybí confirm:true" }] };
      const userId = currentUserId();
      const { error, count } = await deps.db().from("activity_rows").delete({ count: "exact" }).eq("user_id", userId);
      return { content: [{ type: "text", text: error ? `Error: ${error.message}` : `Smazáno ${count ?? 0} řádků` }] };
    },
  });

  // Stateless Streamable HTTP: every request is a JSON-RPC POST answered with JSON (or SSE when
  // the client asks for it). No sessions, so there is no server-initiated GET stream.
  const transport = new StreamableHttpTransport();
  const httpHandler = transport.bind(mcp);
  const app = new Hono();

  app.use("*", async (c, next) => {
    if (c.req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    await next();
    // Set CORS on the *final* response (setting c.res before next() is lost when the handler
    // returns a fresh Response).
    for (const [k, v] of Object.entries(CORS)) c.res.headers.set(k, v);
  });

  app.onError((err, c) => {
    console.error("mcp error", err instanceof Error ? err.message : err);
    return c.json({ error: "Internal server error" }, 500);
  });

  app.all("/*", async (c) => {
    const method = c.req.method;
    // Spec: a server without a GET stream MUST answer 405 (mcp-lite answers 400 when the client
    // sends MCP-Protocol-Version 2025-03-26, which makes some clients give up). DELETE ends a
    // session, and there are none.
    if (method === "GET" || method === "DELETE") {
      return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST, OPTIONS" } });
    }
    const userId = await deps.authUser(c.req.raw);
    if (!userId) {
      return c.json(
        { error: "Unauthorized – send the header Authorization: Bearer <Tokeny MCP token> (Settings → MCP server)" },
        401,
        { "WWW-Authenticate": 'Bearer realm="tokeny", error="invalid_token"' },
      );
    }
    if (!(await deps.userIsPro(userId))) return c.json(proRequiredBody("mcp"), 403);
    return await userCtx.run(userId, () => httpHandler(c.req.raw));
  });

  return app;
}
