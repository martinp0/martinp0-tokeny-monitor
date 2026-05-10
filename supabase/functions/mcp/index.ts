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

const mcp = new McpServer({ name: "openrouter-monitor", version: "1.0.0" });

mcp.tool({
  name: "get_total_cost",
  description: "Vrátí celkové náklady (USD) v daném období. Datumy ve formátu YYYY-MM-DD.",
  inputSchema: {
    type: "object",
    properties: {
      from_date: { type: "string" },
      to_date: { type: "string" },
    },
  },
  handler: async ({ from_date, to_date }: any) => {
    const userId = currentUserId();
    let q = svc().from("activity_rows").select("cost_total").eq("user_id", userId).limit(50000);
    if (from_date) q = q.gte("created_at", from_date);
    if (to_date) q = q.lte("created_at", to_date + "T23:59:59");
    const { data } = await q;
    const total = (data ?? []).reduce((s, r: any) => s + r.cost_total, 0);
    return {
      content: [{ type: "text", text: JSON.stringify({ total_cost_usd: +total.toFixed(4), rows: data?.length ?? 0 }) }],
    };
  },
});

mcp.tool({
  name: "get_cost_by_model",
  description: "Náklady seskupené podle modelu, řazené sestupně.",
  inputSchema: {
    type: "object",
    properties: { from_date: { type: "string" }, to_date: { type: "string" }, limit: { type: "number" } },
  },
  handler: async ({ from_date, to_date, limit = 20 }: any) => {
    const userId = currentUserId();
    let q = svc().from("activity_rows").select("model_permaslug, cost_total, tokens_prompt, tokens_completion").eq("user_id", userId).limit(50000);
    if (from_date) q = q.gte("created_at", from_date);
    if (to_date) q = q.lte("created_at", to_date + "T23:59:59");
    const { data } = await q;
    const buckets: Record<string, { cost: number; tokens: number; n: number }> = {};
    for (const r of (data ?? []) as any[]) {
      const k = r.model_permaslug;
      if (!buckets[k]) buckets[k] = { cost: 0, tokens: 0, n: 0 };
      buckets[k].cost += r.cost_total;
      buckets[k].tokens += r.tokens_prompt + r.tokens_completion;
      buckets[k].n += 1;
    }
    const out = Object.entries(buckets)
      .map(([model, v]) => ({ model, cost_usd: +v.cost.toFixed(4), tokens: v.tokens, requests: v.n }))
      .sort((a, b) => b.cost_usd - a.cost_usd)
      .slice(0, limit);
    return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
  },
});

mcp.tool({
  name: "get_cost_by_provider",
  description: "Náklady seskupené podle providera.",
  inputSchema: { type: "object", properties: {} },
  handler: async () => {
    const userId = currentUserId();
    const { data } = await svc().from("activity_rows").select("provider_name, cost_total").eq("user_id", userId).limit(50000);
    const buckets: Record<string, number> = {};
    for (const r of (data ?? []) as any[]) buckets[r.provider_name] = (buckets[r.provider_name] ?? 0) + r.cost_total;
    const out = Object.entries(buckets).map(([p, c]) => ({ provider: p, cost_usd: +c.toFixed(4) })).sort((a, b) => b.cost_usd - a.cost_usd);
    return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
  },
});

mcp.tool({
  name: "list_recent_requests",
  description: "Posledních N requestů.",
  inputSchema: { type: "object", properties: { limit: { type: "number" } } },
  handler: async ({ limit = 20 }: any) => {
    const userId = currentUserId();
    const { data } = await svc().from("activity_rows").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(Math.min(limit, 100));
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

mcp.tool({
  name: "list_models",
  description: "Seznam všech známých modelů a providerů.",
  inputSchema: { type: "object", properties: {} },
  handler: async () => {
    const userId = currentUserId();
    const { data } = await svc().from("activity_rows").select("model_permaslug, provider_name").eq("user_id", userId).limit(50000);
    const models = [...new Set((data ?? []).map((r: any) => r.model_permaslug))];
    const providers = [...new Set((data ?? []).map((r: any) => r.provider_name))];
    return { content: [{ type: "text", text: JSON.stringify({ models, providers }) }] };
  },
});

mcp.tool({
  name: "delete_request",
  description: "Smaže záznam podle generation_id (write operace). Smaže pouze vlastní záznamy.",
  inputSchema: { type: "object", properties: { generation_id: { type: "string" } }, required: ["generation_id"] },
  handler: async ({ generation_id }: any) => {
    const userId = currentUserId();
    const { error } = await svc().from("activity_rows").delete().eq("generation_id", generation_id).eq("user_id", userId);
    return { content: [{ type: "text", text: error ? `Error: ${error.message}` : `Deleted ${generation_id}` }] };
  },
});

mcp.tool({
  name: "delete_all_data",
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
const app = new Hono();

app.use("*", async (c, next) => {
  // CORS
  c.res.headers.set("Access-Control-Allow-Origin", "*");
  c.res.headers.set("Access-Control-Allow-Headers", "authorization, content-type, mcp-session-id");
  c.res.headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  if (c.req.method === "OPTIONS") return c.body(null, 204);
  await next();
});

app.all("/*", async (c) => {
  const userId = await authUser(c.req.raw);
  if (!userId) return c.json({ error: "Unauthorized – Bearer token required" }, 401);
  return await userCtx.run(userId, () => transport.handleRequest(c.req.raw, mcp));
});

Deno.serve(app.fetch);
