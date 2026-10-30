// Read-only spend summary for the native apps (macOS menu bar, Apple Watch widget).
//
// Auth: the same personal tokens as the MCP server (Settings → MCP tokens; stored only as
// sha256 in mcp_tokens.token_hash). GET only, never writes user data, returns aggregates only
// (no prompts, no request rows, no credentials). Uses the same activity_rows / budget_alerts /
// exchange_rates tables as the web dashboard.
//
//   GET /functions/v1/usage-summary?tz=Europe/Prague
//   Authorization: Bearer orm_...
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const PAGE = 1000; // PostgREST max-rows
const MAX_ROWS = 100_000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function validTz(tz: string | null): string {
  if (!tz) return "Europe/Prague";
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return tz;
  } catch {
    return "Europe/Prague";
  }
}

/** YYYY-MM-DD of an instant in the given time zone. */
function dayKey(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

const round = (n: number, d = 4) => +n.toFixed(d);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const m = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(\S+)$/i);
  if (!m) return json({ error: "Unauthorized – Bearer token required" }, 401);

  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const hash = await sha256Hex(m[1]);
  const { data: tok } = await svc.from("mcp_tokens").select("user_id").eq("token_hash", hash).maybeSingle();
  if (!tok?.user_id) return json({ error: "Unauthorized" }, 401);
  const userId: string = tok.user_id;
  await svc.from("mcp_tokens").update({ last_used_at: new Date().toISOString() }).eq("token_hash", hash);

  try {
    const tz = validTz(new URL(req.url).searchParams.get("tz"));
    const now = new Date();
    const today = dayKey(now, tz);
    const monthKey = today.slice(0, 7);
    const [y, mo] = monthKey.split("-").map(Number);
    const prevMonthKey = mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
    // Fetch from 2 days before the previous month (UTC) so every local day is covered.
    const since = new Date(Date.UTC(mo === 1 ? y - 1 : y, mo === 1 ? 11 : mo - 2, 1) - 2 * 86_400_000);
    const last30 = new Set(Array.from({ length: 30 }, (_, i) => dayKey(new Date(now.getTime() - i * 86_400_000), tz)));

    type Row = {
      created_at: string; cost_total: number; tokens_prompt: number; tokens_completion: number;
      request_count: number | null; model_permaslug: string; provider_name: string;
    };
    const rows: Row[] = [];
    for (let from = 0; from < MAX_ROWS; from += PAGE) {
      const { data, error } = await svc
        .from("activity_rows")
        .select("created_at, cost_total, tokens_prompt, tokens_completion, request_count, model_permaslug, provider_name")
        .eq("user_id", userId)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }) // deterministic paging (created_at ties)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      rows.push(...((data ?? []) as Row[]));
      if (!data || data.length < PAGE) break;
    }

    const zero = () => ({ cost_usd: 0, tokens: 0, requests: 0 });
    const todayAgg = zero(), monthAgg = zero(), prevAgg = zero();
    const daily: Record<string, number> = {};
    const models: Record<string, number> = {};
    const providers: Record<string, number> = {};
    let lastActivity: string | null = null;

    for (const r of rows) {
      const k = dayKey(new Date(r.created_at), tz);
      const cost = Number(r.cost_total) || 0;
      const tokens = (Number(r.tokens_prompt) || 0) + (Number(r.tokens_completion) || 0);
      const reqs = Number(r.request_count) || 1;
      const add = (a: ReturnType<typeof zero>) => { a.cost_usd += cost; a.tokens += tokens; a.requests += reqs; };
      if (k === today) add(todayAgg);
      if (k.startsWith(monthKey)) {
        add(monthAgg);
        models[r.model_permaslug] = (models[r.model_permaslug] ?? 0) + cost;
        providers[r.provider_name] = (providers[r.provider_name] ?? 0) + cost;
      } else if (k.startsWith(prevMonthKey)) add(prevAgg);
      if (last30.has(k)) daily[k] = (daily[k] ?? 0) + cost;
      if (!lastActivity || r.created_at > lastActivity) lastActivity = r.created_at;
    }

    const dayOfMonth = Number(today.slice(8, 10));
    const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();

    const [{ data: budget }, { data: rate }] = await Promise.all([
      svc.from("budget_alerts").select("monthly_budget_usd, threshold_pct, enabled").eq("user_id", userId)
        .order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      svc.from("exchange_rates").select("rate, source_date").eq("currency_pair", "USD_CZK").maybeSingle(),
    ]);

    const fin = (a: ReturnType<typeof zero>) => ({ ...a, cost_usd: round(a.cost_usd) });
    const top = (o: Record<string, number>, n: number) =>
      Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, c]) => ({ name, cost_usd: round(c) }));

    return json({
      version: 1,
      generated_at: now.toISOString(),
      tz,
      today: fin(todayAgg),
      month: { ...fin(monthAgg), key: monthKey },
      previous_month: { ...fin(prevAgg), key: prevMonthKey },
      forecast_month_usd: round(dayOfMonth > 0 ? (monthAgg.cost_usd / dayOfMonth) * daysInMonth : 0),
      budget: budget
        ? { monthly_usd: Number(budget.monthly_budget_usd), threshold_pct: Number(budget.threshold_pct), enabled: !!budget.enabled }
        : null,
      usd_czk: rate?.rate ? { rate: Number(rate.rate), date: rate.source_date ?? null } : null,
      daily: [...last30].sort().map((date) => ({ date, cost_usd: round(daily[date] ?? 0) })),
      top_models: top(models, 5),
      providers: top(providers, 10),
      last_activity_at: lastActivity,
    });
  } catch (e) {
    console.error("usage-summary failed", e instanceof Error ? e.message : "unknown");
    return json({ error: "Internal server error" }, 500);
  }
});
