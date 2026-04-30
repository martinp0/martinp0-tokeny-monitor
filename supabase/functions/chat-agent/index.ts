import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    type: "function",
    function: {
      name: "query_stats",
      description: "Spočítá statistiky nad daty aktivit (cost, tokens, requests, avg latency) s volitelnými filtry.",
      parameters: {
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
  },
  {
    type: "function",
    function: {
      name: "list_models",
      description: "Vrátí seznam všech modelů a providerů, které jsou v datech.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "apply_filters",
      description: "Aplikuje filtry v dashboard UI (model, date range). Předej null pro vyčištění.",
      parameters: {
        type: "object",
        properties: {
          model: { type: ["string", "null"], description: "Plný model_permaslug nebo null pro reset" },
          from_date: { type: ["string", "null"], description: "YYYY-MM-DD nebo null" },
          to_date: { type: ["string", "null"], description: "YYYY-MM-DD nebo null" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_currency",
      description: "Přepne zobrazenou měnu v UI.",
      parameters: {
        type: "object",
        properties: { currency: { type: "string", enum: ["USD", "CZK"] } },
        required: ["currency"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "export_data",
      description: "Spustí export dashboardu (PNG nebo PDF).",
      parameters: {
        type: "object",
        properties: { format: { type: "string", enum: ["png", "pdf"] } },
        required: ["format"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "detect_anomalies",
      description: "Najde neobvyklé výdaje – dny/modely s extrémně vysokým costem oproti průměru.",
      parameters: { type: "object", properties: {} },
    },
  },
];

async function executeTool(
  name: string,
  args: any,
  supabase: ReturnType<typeof createClient>,
): Promise<any> {
  if (name === "list_models") {
    const { data } = await supabase.from("activity_rows").select("model_permaslug, provider_name").limit(2000);
    const models = [...new Set((data ?? []).map((r: any) => r.model_permaslug))];
    const providers = [...new Set((data ?? []).map((r: any) => r.provider_name))];
    return { models, providers, total_models: models.length };
  }

  if (name === "query_stats") {
    let q = supabase.from("activity_rows").select("*").limit(5000);
    if (args.model) q = q.eq("model_permaslug", args.model);
    if (args.provider) q = q.eq("provider_name", args.provider);
    if (args.from_date) q = q.gte("created_at", args.from_date);
    if (args.to_date) q = q.lte("created_at", args.to_date + "T23:59:59");
    const { data } = await q;
    const rows = (data ?? []) as any[];
    if (rows.length === 0) return { count: 0, message: "Žádná data pro dané filtry." };

    const limit = args.limit ?? 10;
    const groupBy = args.group_by;
    const grouper = (r: any) => {
      if (groupBy === "model") return r.model_permaslug;
      if (groupBy === "provider") return r.provider_name;
      if (groupBy === "day") return (r.created_at as string).substring(0, 10);
      if (groupBy === "hour") return (r.created_at as string).substring(0, 13);
      return "all";
    };
    const buckets: Record<string, { cost: number; requests: number; tokens: number; gen_ms: number }> = {};
    for (const r of rows) {
      const k = grouper(r);
      if (!buckets[k]) buckets[k] = { cost: 0, requests: 0, tokens: 0, gen_ms: 0 };
      buckets[k].cost += r.cost_total;
      buckets[k].requests += 1;
      buckets[k].tokens += r.tokens_prompt + r.tokens_completion + r.tokens_reasoning;
      buckets[k].gen_ms += r.generation_time_ms;
    }
    const groups = Object.entries(buckets)
      .map(([k, v]) => ({
        key: k,
        cost_usd: +v.cost.toFixed(4),
        requests: v.requests,
        tokens: v.tokens,
        avg_latency_ms: Math.round(v.gen_ms / v.requests),
        cost_per_1k_tokens: v.tokens > 0 ? +((v.cost / v.tokens) * 1000).toFixed(5) : 0,
      }))
      .sort((a, b) => b.cost_usd - a.cost_usd)
      .slice(0, limit);
    return {
      total_rows: rows.length,
      total_cost_usd: +rows.reduce((s, r) => s + r.cost_total, 0).toFixed(4),
      groups,
    };
  }

  if (name === "detect_anomalies") {
    const { data } = await supabase.from("activity_rows").select("created_at, cost_total, model_permaslug").limit(5000);
    const rows = (data ?? []) as any[];
    if (rows.length === 0) return { anomalies: [] };
    const byDay: Record<string, number> = {};
    for (const r of rows) {
      const d = (r.created_at as string).substring(0, 10);
      byDay[d] = (byDay[d] ?? 0) + r.cost_total;
    }
    const values = Object.values(byDay);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
    const anomalies = Object.entries(byDay)
      .filter(([, v]) => v > mean + 2 * std)
      .map(([day, cost]) => ({ day, cost_usd: +cost.toFixed(4), times_avg: +(cost / mean).toFixed(2) }));
    return { mean_daily_usd: +mean.toFixed(4), std_usd: +std.toFixed(4), anomalies };
  }

  // UI tools – just echo so client can act on them
  return { ui_action: name, args };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();

    // Multi-turn tool loop (max 4 iterations)
    const conv: any[] = [{ role: "system", content: SYSTEM_PROMPT }, ...messages];
    const uiActions: Array<{ name: string; args: any }> = [];

    for (let iter = 0; iter < 4; iter++) {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: conv,
          tools,
          tool_choice: "auto",
        }),
      });

      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit, zkus to za chvíli." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "Vyčerpané AI kredity workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!resp.ok) {
        const t = await resp.text();
        console.error("AI gateway error", resp.status, t);
        throw new Error("AI gateway error");
      }

      const data = await resp.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) throw new Error("No message in AI response");
      conv.push(msg);

      const toolCalls = msg.tool_calls ?? [];
      if (toolCalls.length === 0) {
        return new Response(
          JSON.stringify({ reply: msg.content ?? "", ui_actions: uiActions }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      for (const tc of toolCalls) {
        const args = JSON.parse(tc.function.arguments || "{}");
        const result = await executeTool(tc.function.name, args, supabase);
        if (["apply_filters", "set_currency", "export_data"].includes(tc.function.name)) {
          uiActions.push({ name: tc.function.name, args });
        }
        conv.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
      }
    }

    return new Response(JSON.stringify({ reply: "Příliš mnoho kroků, zkus zjednodušit dotaz.", ui_actions: uiActions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat-agent error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
