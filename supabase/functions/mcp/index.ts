import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import { createClient } from "@supabase/supabase-js";

// Tokens are sha256 hashes (matched against mcp_tokens.token_hash).
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function svc() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function authUser(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const hash = await sha256Hex(m[1].trim());
  const supabase = svc();
  const { data } = await supabase.from("mcp_tokens").select("user_id").eq("token_hash", hash).maybeSingle();
  if (!data) return null;
  await supabase.from("mcp_tokens").update({ last_used_at: new Date().toISOString() }).eq("token_hash", hash);
  return data.user_id;
}

// AsyncLocalStorage so tool handlers can read current caller's user_id without
// changing mcp-lite's handler signature.
import { AsyncLocalStorage } from "node:async_hooks";
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
  const { data, error } = await svc().rpc("activity_aggregate", {
    p_user_id: userId,
    p_from: from || null,
    p_to: to || null,
    p_group_by: groupBy,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as AggRow[];
}

const text = (v: unknown) => ({ content: [{ type: "text" as const, text: typeof v === "string" ? v : JSON.stringify(v, null, 2) }] });

const mcp = new McpServer({ name: "tokeny", version: "1.1.0" });

mcp.tool("get_total_cost", {
  description: "Vrátí celkové náklady (USD) v daném období. Datumy ve formátu YYYY-MM-DD.",
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
  description: "Náklady seskupené podle modelu, řazené sestupně.",
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
  description: "Náklady seskupené podle providera.",
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
  description: "Posledních N requestů.",
  inputSchema: { type: "object", properties: { limit: { type: "number" } } },
  handler: async ({ limit = 20 }: any) => {
    const userId = currentUserId();
    const { data, error } = await svc()
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
  description: "Seznam všech známých modelů a providerů.",
  inputSchema: { type: "object", properties: {} },
  handler: async () => {
    const userId = currentUserId();
    const [models, providers] = await Promise.all([aggregate(userId, "model"), aggregate(userId, "provider")]);
    return text({ models: models.map((r) => r.bucket), providers: providers.map((r) => r.bucket) });
  },
});

mcp.tool("delete_request", {
  description: "Smaže záznam podle generation_id (write operace). Smaže pouze vlastní záznamy.",
  inputSchema: { type: "object", properties: { generation_id: { type: "string" } }, required: ["generation_id"] },
  handler: async ({ generation_id }: any) => {
    const userId = currentUserId();
    const { error } = await svc().from("activity_rows").delete().eq("generation_id", generation_id).eq("user_id", userId);
    return { content: [{ type: "text", text: error ? `Error: ${error.message}` : `Deleted ${generation_id}` }] };
  },
});

mcp.tool("delete_all_data", {
  description: "POZOR: Smaže VŠECHNA vaše data. Vyžaduje confirm=true.",
  inputSchema: { type: "object", properties: { confirm: { type: "boolean" } }, required: ["confirm"] },
  handler: async ({ confirm }: any) => {
    if (!confirm) return { content: [{ type: "text", text: "Operace zrušena – chybí confirm:true" }] };
    const userId = currentUserId();
    const { error, count } = await svc().from("activity_rows").delete({ count: "exact" }).eq("user_id", userId);
    return { content: [{ type: "text", text: error ? `Error: ${error.message}` : `Smazáno ${count ?? 0} řádků` }] };
  },
});

const transport = new StreamableHttpTransport();
const httpHandler = transport.bind(mcp);
const app = new Hono();

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, mcp-session-id, mcp-protocol-version",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "mcp-session-id",
};

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
  const userId = await authUser(c.req.raw);
  if (!userId) return c.json({ error: "Unauthorized – Bearer token required" }, 401);
  return await userCtx.run(userId, () => httpHandler(c.req.raw));
});

Deno.serve(app.fetch);
