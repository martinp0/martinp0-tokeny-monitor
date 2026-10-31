// AI agent (Pro) and the "Fun" page helpers. Both call Anthropic with the server's ANTHROPIC_API_KEY
// and return 503 when it isn't configured. Data tools read only the caller's rows (repo.aggregateActivity).
import type { Db } from "./db.js";
import { aggregateActivity, type AggRow } from "./repo.js";

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

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);


async function aggregate(
  db: Db,
  userId: string,
  groupBy: string,
  args: { model?: string; provider?: string; from_date?: string; to_date?: string } = {},
): Promise<AggRow[]> {
  return aggregateActivity(db, userId, {
    groupBy,
    model: typeof args.model === "string" && args.model ? args.model : null,
    provider: typeof args.provider === "string" && args.provider ? args.provider : null,
    from: isDate(args.from_date) ? args.from_date : null,
    to: isDate(args.to_date) ? args.to_date : null,
  });
}

// deno-lint-ignore no-explicit-any
async function executeTool(name: string, args: any, db: Db, userId: string): Promise<unknown> {
  if (name === "list_models") {
    const [models, providers] = await Promise.all([aggregate(db, userId, "model"), aggregate(db, userId, "provider")]);
    return { models: models.map((r) => r.bucket), providers: providers.map((r) => r.bucket), total_models: models.length };
  }
  if (name === "query_stats") {
    const groupBy = ["model", "provider", "day", "hour", "none"].includes(args?.group_by) ? args.group_by : "none";
    const rows = await aggregate(db, userId, groupBy, args ?? {});
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
    const days = await aggregate(db, userId, "day");
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

export interface AiResult { status: number; body: unknown }

function anthropicKey(): string | null {
  return process.env.ANTHROPIC_API_KEY || null;
}

async function callAnthropic(key: string, body: unknown): Promise<Response> {
  return fetch(ANTHROPIC_API, {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Caller must already be authenticated and Pro. */
// deno-lint-ignore no-explicit-any
export async function chatAgent(db: Db, userId: string, input: any): Promise<AiResult> {
  const key = anthropicKey();
  if (!key) return { status: 503, body: { error: "AI asistent je dočasně nedostupný." } };
  const messages = input?.messages;
  if (!Array.isArray(messages)) return { status: 400, body: { error: "messages must be an array" } };
  if (messages.length === 0 || messages.length > 20) return { status: 400, body: { error: "messages length must be between 1 and 20" } };
  const MAX_CONTENT_CHARS = 4000;
  for (const m of messages) {
    if (!m || typeof m !== "object" || !["user", "assistant", "system"].includes(m.role)) {
      return { status: 400, body: { error: "invalid message shape" } };
    }
    const contentStr = typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "");
    if (contentStr.length > MAX_CONTENT_CHARS) {
      return { status: 400, body: { error: `message content exceeds ${MAX_CONTENT_CHARS} characters` } };
    }
  }
  // deno-lint-ignore no-explicit-any
  const anthropicMessages: any[] = messages.filter((m: any) => m.role !== "system");
  // deno-lint-ignore no-explicit-any
  const uiActions: Array<{ name: string; args: any }> = [];
  for (let iter = 0; iter < 4; iter++) {
    const resp = await callAnthropic(key, { model: MODEL, max_tokens: 1024, system: SYSTEM_PROMPT, messages: anthropicMessages, tools });
    if (resp.status === 429) return { status: 429, body: { error: "Rate limit, zkus to za chvíli." } };
    if (!resp.ok) {
      console.error("Anthropic API error", resp.status);
      return { status: 502, body: { error: "AI asistent teď neodpovídá." } };
    }
    const data = await resp.json();
    const content = data.content ?? [];
    anthropicMessages.push({ role: "assistant", content });
    if (data.stop_reason !== "tool_use") {
      // deno-lint-ignore no-explicit-any
      const text = content.find((b: any) => b.type === "text");
      return { status: 200, body: { reply: text?.text ?? "", ui_actions: uiActions } };
    }
    const toolResults: unknown[] = [];
    for (const block of content) {
      if (block.type !== "tool_use") continue;
      const result = await executeTool(block.name, block.input, db, userId);
      if (["apply_filters", "set_currency", "export_data"].includes(block.name)) uiActions.push({ name: block.name, args: block.input });
      toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
    }
    anthropicMessages.push({ role: "user", content: toolResults });
  }
  return { status: 200, body: { reply: "Příliš mnoho kroků, zkus zjednodušit dotaz.", ui_actions: uiActions } };
}

/** "Fun" page: a joke or a cartoon prompt + Pollinations image URL. Requires a signed-in caller. */
export async function funAi(mode: unknown): Promise<AiResult> {
  if (mode !== "joke" && mode !== "image") return { status: 400, body: { error: "Invalid mode" } };
  const key = anthropicKey();
  if (!key) return { status: 503, body: { error: "AI funkce jsou dočasně nedostupné." } };
  if (mode === "joke") {
    const r = await callAnthropic(key, {
      model: MODEL,
      max_tokens: 256,
      system: "Jsi vtipný český komik. Generuj originální, krátké vtipy v češtině. Můžeš dělat vtipy o programování, AI, technologiích, nebo obecné vtipy. Buď kreativní a překvapivý. Vrať POUZE vtip, nic jiného. Žádné uvozovky, žádné komentáře.",
      messages: [{ role: "user", content: "Vygeneruj jeden krátký vtip." }],
    });
    if (r.status === 429) return { status: 429, body: { error: "Příliš mnoho požadavků, zkus to za chvíli." } };
    if (!r.ok) return { status: 502, body: { error: "AI teď neodpovídá." } };
    const data = await r.json();
    return { status: 200, body: { joke: data.content?.[0]?.text || "Žádný vtip se nenašel 😢" } };
  }
  const r = await callAnthropic(key, {
    model: MODEL,
    max_tokens: 128,
    system: "Generate a short, vivid English image prompt (max 20 words) for a funny, absurd cartoon scene. Be creative and surprising. Reply with ONLY the prompt, no quotes, no explanation.",
    messages: [{ role: "user", content: "Generate one funny image prompt." }],
  });
  let prompt = "a cat coding on a laptop while drinking coffee";
  if (r.ok) {
    const pd = await r.json();
    prompt = pd.content?.[0]?.text?.trim() || prompt;
  }
  const image = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&model=flux&width=512&height=512`;
  return { status: 200, body: { image, text: prompt } };
}
