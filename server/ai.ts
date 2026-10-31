// AI assistant and the "Fun" page helpers. Both call the user's chosen provider (Anthropic, OpenAI
// or OpenRouter) with the CALLER'S OWN API key (ai_keys, BYOK); there is deliberately no shared
// server key. The user pays the provider directly. Data tools read only the caller's rows
// (repo.aggregateActivity). Keys are never logged or returned.
import type { Db } from "./db.js";
import { aggregateActivity, type AggRow } from "./repo.js";
import { PROVIDERS, providerChat, type AiErrorCode, type AiProvider, type NeutralMessage, type ToolDef } from "./ai-providers.js";

export type { AiErrorCode } from "./ai-providers.js";

/** The caller's resolved AI setup: provider, their own key, and the model to use. */
export interface AiContext { provider: AiProvider; key: string; model: string }

const SYSTEM_PROMPT = `Jsi AI asistent v dashboardu Tokeny (analytika nákladů na AI modely).
Mluvíš česky, stručně a přátelsky. Máš k dispozici tools pro dotazy nad daty a pro ovládání UI.

Pravidla:
- Pro VŠECHNY dotazy o datech (kolik, kdy, jaký model, top X) MUSÍŠ použít tool query_stats nebo list_models.
- Pro ovládání UI (filtr modelu, datum, currency, export) použij příslušný akční tool.
- Po zavolání tool stručně shrň výsledek v češtině. Čísla formátuj rozumně ($0.0123, 1 234 tokenů).
- Když uživatel řekne "vyčisti filtry", "zruš filtr", zavolej apply_filters s null hodnotami.
- Buď proaktivní: pokud něco vypadá zajímavě (extrémní cena, anomálie), zmiň to.`;

const tools: ToolDef[] = [
  {
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
  {
    name: "list_models",
    description: "Vrátí seznam všech modelů a providerů, které jsou v datech.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "apply_filters",
    description: "Aplikuje filtry v dashboard UI (model, date range). Předej null pro vyčištění.",
    parameters: {
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
    parameters: {
      type: "object",
      properties: { currency: { type: "string", enum: ["USD", "CZK"] } },
      required: ["currency"],
    },
  },
  {
    name: "export_data",
    description: "Spustí export dashboardu (PNG nebo PDF).",
    parameters: {
      type: "object",
      properties: { format: { type: "string", enum: ["png", "pdf"] } },
      required: ["format"],
    },
  },
  {
    name: "detect_anomalies",
    description: "Najde neobvyklé výdaje – dny/modely s extrémně vysokým costem oproti průměru.",
    parameters: { type: "object", properties: {} },
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

const AI_ERRORS: Record<AiErrorCode, { status: number; error: (p: string) => string }> = {
  ai_key_missing: { status: 428, error: () => "AI funkce používají tvůj vlastní API klíč (Anthropic, OpenAI nebo OpenRouter). Přidej ho v Nastavení." },
  ai_key_invalid: { status: 422, error: (p) => `${p} tvůj API klíč odmítl. Zkontroluj ho a ulož znovu v Nastavení.` },
  ai_key_no_credit: { status: 402, error: (p) => `Na tvém účtu ${p} došel kredit nebo narazil na limit útraty. Dobij ho přímo u ${p}.` },
  ai_model_unavailable: { status: 422, error: (p) => `Zvolený model ${p} nezná nebo k němu tvůj klíč nemá přístup. Vyber jiný model v Nastavení.` },
  ai_rate_limited: { status: 429, error: (p) => `${p} hlásí limit požadavků, zkus to za chvíli.` },
  ai_unavailable: { status: 502, error: () => "AI teď neodpovídá, zkus to za chvíli." },
};

/** Error body for the UI: message, stable code, the provider and where to fix it. */
export function aiError(code: AiErrorCode, provider?: AiProvider): AiResult {
  const info = provider ? PROVIDERS[provider] : null;
  const e = AI_ERRORS[code];
  return {
    status: e.status,
    body: {
      error: e.error(info?.label ?? "Poskytovatel AI"),
      code,
      provider: provider ?? null,
      help_url: code === "ai_key_no_credit" && info ? info.billingUrl : info ? info.keysUrl : "/settings#ai-key",
    },
  };
}

const MAX_TOKENS = 2048;

/** `ctx` is the caller's own provider + key + model. Open to every signed-in user (BYOK). */
// deno-lint-ignore no-explicit-any
export async function chatAgent(db: Db, userId: string, input: any, ctx: AiContext): Promise<AiResult> {
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
  // Client history is plain text; client-sent "system" messages are ignored.
  const convo: NeutralMessage[] = messages
    // deno-lint-ignore no-explicit-any
    .filter((m: any) => m.role !== "system")
    // deno-lint-ignore no-explicit-any
    .map((m: any): NeutralMessage => {
      const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "");
      return m.role === "user" ? { role: "user", text } : { role: "assistant", text, toolCalls: [] };
    });
  // deno-lint-ignore no-explicit-any
  const uiActions: Array<{ name: string; args: any }> = [];
  for (let iter = 0; iter < 4; iter++) {
    const resp = await providerChat(ctx.provider, ctx.key, { model: ctx.model, system: SYSTEM_PROMPT, messages: convo, tools, maxTokens: MAX_TOKENS });
    if (resp.ok === false) return aiError(resp.code, ctx.provider);
    const turn = resp.turn;
    convo.push({ role: "assistant", text: turn.text, toolCalls: turn.toolCalls, raw: turn.raw });
    if (turn.toolCalls.length === 0) return { status: 200, body: { reply: turn.text, ui_actions: uiActions } };
    const results: { id: string; name: string; content: string }[] = [];
    for (const call of turn.toolCalls) {
      const result = await executeTool(call.name, call.args, db, userId);
      if (["apply_filters", "set_currency", "export_data"].includes(call.name)) uiActions.push({ name: call.name, args: call.args });
      results.push({ id: call.id, name: call.name, content: JSON.stringify(result) });
    }
    convo.push({ role: "tool", results });
  }
  return { status: 200, body: { reply: "Příliš mnoho kroků, zkus zjednodušit dotaz.", ui_actions: uiActions } };
}

/** Validates the Fun mode before any key lookup. */
export const isFunMode = (mode: unknown): mode is "joke" | "image" => mode === "joke" || mode === "image";

/** "Fun" page: a joke or a cartoon prompt + Pollinations image URL, with the caller's own key. */
export async function funAi(mode: "joke" | "image", ctx: AiContext): Promise<AiResult> {
  const ask = (system: string, user: string, maxTokens: number) =>
    providerChat(ctx.provider, ctx.key, { model: ctx.model, system, messages: [{ role: "user", text: user }], maxTokens });
  if (mode === "joke") {
    const r = await ask(
      "Jsi vtipný český komik. Generuj originální, krátké vtipy v češtině. Můžeš dělat vtipy o programování, AI, technologiích, nebo obecné vtipy. Buď kreativní a překvapivý. Vrať POUZE vtip, nic jiného. Žádné uvozovky, žádné komentáře.",
      "Vygeneruj jeden krátký vtip.",
      512,
    );
    if (r.ok === false) return aiError(r.code, ctx.provider);
    return { status: 200, body: { joke: r.turn.text || "Žádný vtip se nenašel 😢" } };
  }
  const r = await ask(
    "Generate a short, vivid English image prompt (max 20 words) for a funny, absurd cartoon scene. Be creative and surprising. Reply with ONLY the prompt, no quotes, no explanation.",
    "Generate one funny image prompt.",
    256,
  );
  if (r.ok === false) return aiError(r.code, ctx.provider);
  const prompt = r.turn.text || "a cat coding on a laptop while drinking coffee";
  const image = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&model=flux&width=512&height=512`;
  return { status: 200, body: { image, text: prompt } };
}
