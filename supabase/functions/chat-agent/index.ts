import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// deno-lint-ignore no-explicit-any
type Db = SupabaseClient<any, "public", any>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `Jsi AI asistent v dashboardu OpenRouter Monitor (analytika nákladů na AI modely).
Mluvíš česky, stručně a přátelsky. Máš k dispozici tools pro dotazy nad daty a pro ovládání UI.

Pravidla:
- Pro VŠECHNY dotazy o datech (kolik, kdy, jaký model, top X) MUSÍŠ použít tool query_stats nebo list_models.
- Pro ovládání UI (filtr modelu, datum, currency, export) použij příslušný akční tool.
- Po zavolání tool stručně shrň výsledek v češtině. Čísla formátuj rozumně ($0.0123, 1 234 tokenů).
- Když uživatel řekne "vyčisti filtry", "zruš filtr", zavolej apply_filters s null hodnotami.
- Buď proaktivní: pokud něco vypadá zajímavě (extrémní cena, anomálie), zmiň to.`;

const tools = [
  {
    name: "query_stats",
    description: "Spočítá statistiky nad daty aktivit (cost, tokens, requests, avg latency) s volitelnými filtry.",
    input_schema: {
      type: "object",
      properties: {
        group_by: { type: "string", enum: ["model", "provider", "day", "hour", "none"], description: "Jak grupovat výsledky" },
        model: { type: "string", description: "Filtr na model_permaslug (např. 'openai/gpt-5-nano')" },
        provider: { type: "string", description: "Filtr na provider_name" },
        from_date: { type: "string", description: "ISO datum YYYY-MM-DD od kdy" },
        to_date: { type: "string", description: "ISO datum YYYY-MM-DD do kdy" },
        limit: { type: "number", description: "Max počet skupin (default 10)" },
      },
      required: ["group_by"],
    },
  },
  {
    name: "list_models",
    description: "Vrátí seznam všech modelů a providerů, které jsou v datech.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "apply_filters",
    description: "Aplikuje filtry v dashboard UI (model, date range). Předej null pro vyčištění.",
    input_schema: {
      type: "object",
      properties: {
        model: { type: "string", description: "Plný model_permaslug nebo null pro reset" },
        from_date: { type: "string", description: "YYYY-MM-DD nebo null" },
        to_date: { type: "string", description: "YYYY-MM-DD nebo null" },
      },
    },
  },
  {
    name: "set_currency",
    description: "Přepne zobrazenou měnu v UI.",
    input_schema: {
      type: "object",
      properties: { currency: { type: "string", enum: ["USD", "CZK"] } },
      required: ["currency"],
    },
  },
  {
    name: "export_data",
    description: "Spustí export dashboardu (PNG nebo PDF).",
    input_schema: {
      type: "object",
      properties: { format: { type: "string", enum: ["png", "pdf"] } },
      required: ["format"],
    },
  },
  {
    name: "detect_anomalies",
    description: "Najde neobvyklé výdaje – dny/modely s extrémně vysokým costem oproti průměru.",
    input_schema: { type: "object", properties: {} },
  },
];

type AggRow = {
  bucket: string;
  cost_total: number;
  request_count: number;
  row_count: number;
  tokens_prompt: number;
  tokens_completion: number;
  tokens_reasoning: number;
  generation_time_ms_sum: number;
  timed_rows: number;
};

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

// All aggregation happens in SQL (public.activity_aggregate, security invoker) using the
// caller's JWT, so RLS scopes it to the caller's rows and nothing is truncated at 1000 rows.
async function aggregate(
  supabase: Db,
  groupBy: string,
  args: { model?: string; provider?: string; from_date?: string; to_date?: string } = {},
): Promise<AggRow[]> {
  const { data, error } = await supabase.rpc("activity_aggregate", {
    p_group_by: groupBy,
    p_model: typeof args.model === "string" && args.model ? args.model : null,
    p_provider: typeof args.provider === "string" && args.provider ? args.provider : null,
    p_from: isDate(args.from_date) ? args.from_date : null,
    p_to: isDate(args.to_date) ? args.to_date : null,
  });
  if (error) throw new Error(`activity_aggregate failed: ${error.message}`);
  return (data ?? []) as AggRow[];
}

async function executeTool(
  name: string,
  args: any,
  supabase: Db,
): Promise<any> {
  if (name === "list_models") {
    const [models, providers] = await Promise.all([aggregate(supabase, "model"), aggregate(supabase, "provider")]);
    return { models: models.map((r) => r.bucket), providers: providers.map((r) => r.bucket), total_models: models.length };
  }

  if (name === "query_stats") {
    const groupBy = ["model", "provider", "day", "hour", "none"].includes(args?.group_by) ? args.group_by : "none";
    const rows = await aggregate(supabase, groupBy, args ?? {});
    if (rows.length === 0) return { count: 0, message: "Žádná data pro dané filtry." };
    const limit = Math.max(1, Math.min(Number(args?.limit) || 10, 100));
    const groups = rows
      .map((r) => {
        const tokens = Number(r.tokens_prompt) + Number(r.tokens_completion) + Number(r.tokens_reasoning);
        const cost = Number(r.cost_total);
        return {
          key: r.bucket,
          cost_usd: +cost.toFixed(4),
          requests: Number(r.request_count),
          tokens,
          avg_latency_ms: Number(r.timed_rows) > 0 ? Math.round(Number(r.generation_time_ms_sum) / Number(r.timed_rows)) : null,
          cost_per_1k_tokens: tokens > 0 ? +((cost / tokens) * 1000).toFixed(5) : 0,
        };
      })
      .sort((a, b) => b.cost_usd - a.cost_usd);
    return {
      total_rows: rows.reduce((s, r) => s + Number(r.row_count), 0),
      total_requests: rows.reduce((s, r) => s + Number(r.request_count), 0),
      total_cost_usd: +rows.reduce((s, r) => s + Number(r.cost_total), 0).toFixed(4),
      groups: groups.slice(0, limit),
    };
  }

  if (name === "detect_anomalies") {
    const days = await aggregate(supabase, "day");
    if (days.length === 0) return { anomalies: [] };
    const values = days.map((d) => Number(d.cost_total));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
    const anomalies = days
      .filter((d) => Number(d.cost_total) > mean + 2 * std)
      .map((d) => ({ day: d.bucket, cost_usd: +Number(d.cost_total).toFixed(4), times_avg: mean > 0 ? +(Number(d.cost_total) / mean).toFixed(2) : null }))
      .sort((a, b) => a.day.localeCompare(b.day));
    return { mean_daily_usd: +mean.toFixed(4), std_usd: +std.toFixed(4), days: days.length, anomalies };
  }

  return { ui_action: name, args };
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    // Authenticate first: unauthenticated callers always get 401, regardless of server config.
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!/^Bearer\s+\S+$/i.test(authHeader)) return jsonResponse({ error: "Unauthorized" }, 401);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userRes } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
    if (!userRes?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Server-side Pro subscription enforcement (AI agent is a Pro feature)
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: sub } = await svc
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("user_id", userRes.user.id)
      .in("status", ["active", "trialing"])
      .gt("current_period_end", new Date().toISOString())
      .maybeSingle();
    if (!sub) {
      return new Response(JSON.stringify({ error: "Pro subscription required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      console.error("chat-agent: ANTHROPIC_API_KEY is not configured");
      return jsonResponse({ error: "AI asistent je dočasně nedostupný." }, 503);
    }

    const { messages } = await req.json().catch(() => ({ messages: null }));

    // Input validation to prevent API cost abuse
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages must be an array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (messages.length === 0 || messages.length > 20) {
      return new Response(JSON.stringify({ error: "messages length must be between 1 and 20" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const MAX_CONTENT_CHARS = 4000;
    for (const m of messages) {
      if (!m || typeof m !== "object" || !["user", "assistant", "system"].includes(m.role)) {
        return new Response(JSON.stringify({ error: "invalid message shape" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const contentStr = typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "");
      if (contentStr.length > MAX_CONTENT_CHARS) {
        return new Response(JSON.stringify({ error: `message content exceeds ${MAX_CONTENT_CHARS} characters` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Convert OpenAI-style message history to Anthropic format (strip system messages)
    const anthropicMessages = messages.filter((m: any) => m.role !== "system");

    const uiActions: Array<{ name: string; args: any }> = [];

    // Multi-turn tool loop (max 4 iterations)
    for (let iter = 0; iter < 4; iter++) {
      const resp = await fetch(ANTHROPIC_API, {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: anthropicMessages,
          tools,
        }),
      });

      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit, zkus to za chvíli." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!resp.ok) {
        const t = await resp.text();
        console.error("Anthropic API error", resp.status, t);
        throw new Error("Anthropic API error");
      }

      const data = await resp.json();
      const stopReason = data.stop_reason;
      const content = data.content ?? [];

      // Add assistant turn to conversation
      anthropicMessages.push({ role: "assistant", content });

      if (stopReason !== "tool_use") {
        const textContent = content.find((b: any) => b.type === "text");
        return new Response(
          JSON.stringify({ reply: textContent?.text ?? "", ui_actions: uiActions }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Execute all tool calls and collect results
      const toolResults: any[] = [];
      for (const block of content) {
        if (block.type !== "tool_use") continue;
        const result = await executeTool(block.name, block.input, supabase);
        if (["apply_filters", "set_currency", "export_data"].includes(block.name)) {
          uiActions.push({ name: block.name, args: block.input });
        }
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }

      anthropicMessages.push({ role: "user", content: toolResults });
    }

    return new Response(JSON.stringify({ reply: "Příliš mnoho kroků, zkus zjednodušit dotaz.", ui_actions: uiActions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat-agent error", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
