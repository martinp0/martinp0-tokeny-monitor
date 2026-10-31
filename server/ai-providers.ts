// Provider abstraction for the AI features. Every call uses the CALLER'S OWN key (BYOK); there
// is no shared server key. Anthropic speaks the Messages API, OpenAI and OpenRouter speak Chat
// Completions. Messages and tools are kept in a neutral shape and converted per provider.
// Keys are never logged, returned or put into error messages.

export type AiProvider = "anthropic" | "openai" | "openrouter";
export const AI_PROVIDERS: AiProvider[] = ["anthropic", "openai", "openrouter"];
export const isAiProvider = (p: unknown): p is AiProvider => typeof p === "string" && (AI_PROVIDERS as string[]).includes(p);

export interface ProviderInfo {
  id: AiProvider;
  label: string;
  keysUrl: string;
  billingUrl: string;
  keyPrefix: string;
  defaultModel: string;
  /** Suggested cheap models with tool calling (the user may type any other model id). */
  models: { id: string; label: string }[];
}

// Model ids checked against the providers' docs / OpenRouter's public model list on 2026-10-31.
export const PROVIDERS: Record<AiProvider, ProviderInfo> = {
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    keysUrl: "https://console.anthropic.com/settings/keys",
    billingUrl: "https://console.anthropic.com/settings/billing",
    keyPrefix: "sk-ant-",
    defaultModel: "claude-haiku-5-5",
    models: [
      { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 (nejlevnější)" },
      { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
    ],
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    keysUrl: "https://platform.openai.com/api-keys",
    billingUrl: "https://platform.openai.com/settings/organization/billing/overview",
    keyPrefix: "sk-",
    defaultModel: "gpt-6-luna",
    models: [
      { id: "gpt-6-luna", label: "GPT-6 Luna (nejlevnější)" },
      { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
    ],
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    keysUrl: "https://openrouter.ai/settings/keys",
    billingUrl: "https://openrouter.ai/settings/credits",
    keyPrefix: "sk-or-",
    defaultModel: "anthropic/claude-haiku-5.5",
    models: [
      { id: "anthropic/claude-haiku-5.5", label: "Claude Haiku 5.5" },
      { id: "openai/gpt-6-luna", label: "GPT-6 Luna" },
      { id: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
    ],
  },
};

/** Model ids we accept from the user (provider ids are plain ASCII). */
export const isModelId = (m: unknown): m is string => typeof m === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,99}$/.test(m);

/** Stable error codes the UI maps to an empty state / message. */
export type AiErrorCode =
  | "ai_key_missing"
  | "ai_key_invalid"
  | "ai_key_no_credit"
  | "ai_model_unavailable"
  | "ai_rate_limited"
  | "ai_unavailable";

export interface ToolDef { name: string; description: string; parameters: Record<string, unknown> }
export interface ToolCall { id: string; name: string; args: Record<string, unknown> }
export type NeutralMessage =
  | { role: "user"; text: string }
  // `raw` keeps the provider's own assistant payload (e.g. Anthropic thinking blocks) for replay.
  | { role: "assistant"; text: string; toolCalls: ToolCall[]; raw?: unknown }
  | { role: "tool"; results: { id: string; name: string; content: string }[] };

export interface ChatRequest {
  model: string;
  system: string;
  messages: NeutralMessage[];
  tools?: ToolDef[];
  maxTokens: number;
}
export interface ChatTurn { text: string; toolCalls: ToolCall[]; raw?: unknown }
export type ChatResult = { ok: true; turn: ChatTurn } | { ok: false; code: AiErrorCode };

const SITE = "https://tokeny.martinpohl.cz";

/** Map a provider's error (HTTP status + parsed body) to our code. Never sees the key. */
export function classifyProviderError(provider: AiProvider, status: number, body: unknown): AiErrorCode {
  const msg = JSON.stringify(body ?? "").toLowerCase();
  if (status === 401) return "ai_key_invalid";
  if (status === 402) return "ai_key_no_credit";
  if (msg.includes("insufficient_quota") || msg.includes("credit balance") || msg.includes("insufficient credits")) return "ai_key_no_credit";
  if (status === 403) return provider === "openrouter" ? "ai_key_no_credit" : "ai_key_invalid"; // OpenRouter 403 = budget limit
  if (status === 429) return "ai_rate_limited";
  if (status === 404 || ((status === 400 || status === 422) && msg.includes("model"))) return "ai_model_unavailable";
  if (status === 400 && msg.includes("credit")) return "ai_key_no_credit";
  return "ai_unavailable";
}

async function post(provider: AiProvider, url: string, headers: Record<string, string>, body: unknown) {
  let resp: Response;
  try {
    resp = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  } catch {
    console.error("AI provider unreachable", provider);
    return { ok: false as const, code: "ai_unavailable" as AiErrorCode, status: 0, body: null };
  }
  const data = await resp.json().catch(() => null);
  // OpenRouter can answer 200 with an { error } body when the upstream fails.
  const embedded = data && typeof data === "object" && "error" in data && !("choices" in data) ? (data as any).error : null;
  if (!resp.ok || embedded) {
    const status = !resp.ok ? resp.status : Number(embedded?.code) || 502;
    const code = classifyProviderError(provider, status, data);
    console.error("AI provider error", provider, status, code);
    return { ok: false as const, code, status, body: data };
  }
  if (!data || typeof data !== "object") return { ok: false as const, code: "ai_unavailable" as AiErrorCode, status: resp.status, body: null };
  return { ok: true as const, data: data as any };
}

// ---------------------------------------------------------------- Anthropic (Messages API)
function toAnthropicMessages(messages: NeutralMessage[]) {
  return messages.map((m) => {
    if (m.role === "user") return { role: "user", content: m.text };
    if (m.role === "tool") {
      return { role: "user", content: m.results.map((r) => ({ type: "tool_result", tool_use_id: r.id, content: r.content })) };
    }
    if (Array.isArray(m.raw)) return { role: "assistant", content: m.raw };
    const content: unknown[] = [];
    if (m.text) content.push({ type: "text", text: m.text });
    for (const c of m.toolCalls) content.push({ type: "tool_use", id: c.id, name: c.name, input: c.args });
    return { role: "assistant", content: content.length ? content : m.text };
  });
}

async function anthropicChat(key: string, req: ChatRequest): Promise<ChatResult> {
  const r = await post("anthropic", "https://api.anthropic.com/v1/messages", { "x-api-key": key, "anthropic-version": "2023-06-01" }, {
    model: req.model,
    max_tokens: req.maxTokens,
    system: req.system,
    messages: toAnthropicMessages(req.messages),
    ...(req.tools?.length ? { tools: req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })) } : {}),
  });
  if (r.ok === false) return { ok: false, code: r.code };
  const content: any[] = Array.isArray(r.data.content) ? r.data.content : [];
  const text = content.filter((b) => b?.type === "text").map((b) => b.text).join("\n").trim();
  const toolCalls = content
    .filter((b) => b?.type === "tool_use")
    .map((b) => ({ id: String(b.id), name: String(b.name), args: b.input && typeof b.input === "object" ? b.input : {} }));
  return { ok: true, turn: { text, toolCalls, raw: content } };
}

// ------------------------------------------------- OpenAI / OpenRouter (Chat Completions API)
function toChatCompletionMessages(system: string, messages: NeutralMessage[]) {
  const out: any[] = [{ role: "system", content: system }];
  for (const m of messages) {
    if (m.role === "user") out.push({ role: "user", content: m.text });
    else if (m.role === "tool") for (const r of m.results) out.push({ role: "tool", tool_call_id: r.id, content: r.content });
    else {
      out.push({
        role: "assistant",
        content: m.text || null,
        ...(m.toolCalls.length
          ? { tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.args) } })) }
          : {}),
      });
    }
  }
  return out;
}

function parseArgs(s: unknown): Record<string, unknown> {
  if (s && typeof s === "object") return s as Record<string, unknown>;
  try {
    const v = JSON.parse(String(s ?? "{}"));
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

async function chatCompletions(provider: "openai" | "openrouter", key: string, req: ChatRequest): Promise<ChatResult> {
  const url = provider === "openai" ? "https://api.openai.com/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions";
  const headers: Record<string, string> = { authorization: `Bearer ${key}` };
  if (provider === "openrouter") Object.assign(headers, { "HTTP-Referer": SITE, "X-Title": "Tokeny" });
  const base: Record<string, unknown> = {
    model: req.model,
    messages: toChatCompletionMessages(req.system, req.messages),
    ...(req.tools?.length ? { tools: req.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } })) } : {}),
  };
  if (provider === "openai") base.max_completion_tokens = req.maxTokens;
  else base.max_tokens = req.maxTokens;
  // Newer OpenAI reasoning models only allow function calling in Chat Completions with
  // reasoning_effort "none"; older models reject the parameter, so retry once without it.
  let r = await post(provider, url, headers, provider === "openai" ? { ...base, reasoning_effort: "none" } : base);
  if (r.ok === false && provider === "openai" && r.status === 400 && JSON.stringify(r.body ?? "").includes("reasoning_effort")) {
    r = await post(provider, url, headers, base);
  }
  if (r.ok === false) return { ok: false, code: r.code };
  const msg = r.data.choices?.[0]?.message ?? {};
  const text = typeof msg.content === "string" ? msg.content.trim() : "";
  const toolCalls = (Array.isArray(msg.tool_calls) ? msg.tool_calls : [])
    .filter((c: any) => c?.function?.name)
    .map((c: any, i: number) => ({ id: String(c.id ?? `call_${i}`), name: String(c.function.name), args: parseArgs(c.function.arguments) }));
  return { ok: true, turn: { text, toolCalls } };
}

/** One model turn with the caller's key. */
export function providerChat(provider: AiProvider, key: string, req: ChatRequest): Promise<ChatResult> {
  return provider === "anthropic" ? anthropicChat(key, req) : chatCompletions(provider, key, req);
}

// ------------------------------------------------------------ free key checks (no tokens billed)
export type KeyCheck = "ok" | "invalid" | "management" | "unknown";

export async function verifyProviderKey(provider: AiProvider, key: string): Promise<KeyCheck> {
  try {
    if (provider === "anthropic") {
      const r = await fetch("https://api.anthropic.com/v1/models?limit=1", { headers: { "x-api-key": key, "anthropic-version": "2023-06-01" } });
      if (r.ok) return "ok";
      return r.status === 401 || r.status === 403 ? "invalid" : "unknown";
    }
    if (provider === "openai") {
      const r = await fetch("https://api.openai.com/v1/models", { headers: { authorization: `Bearer ${key}` } });
      if (r.ok) return "ok";
      return r.status === 401 ? "invalid" : r.status === 403 ? "invalid" : "unknown";
    }
    // OpenRouter: only management (provisioning) keys may list keys; they cannot run models.
    const keys = await fetch("https://openrouter.ai/api/v1/keys", { headers: { authorization: `Bearer ${key}` } });
    if (keys.ok) return "management";
    // /key describes the calling inference key and costs nothing.
    const r = await fetch("https://openrouter.ai/api/v1/key", { headers: { authorization: `Bearer ${key}` } });
    if (r.ok) return "ok";
    return r.status === 401 || r.status === 403 ? "invalid" : "unknown";
  } catch {
    return "unknown";
  }
}

/** Live model list for the model picker (free; uses the caller's key where the API needs one). */
export async function listProviderModels(provider: AiProvider, key: string): Promise<string[] | null> {
  try {
    if (provider === "anthropic") {
      const r = await fetch("https://api.anthropic.com/v1/models?limit=100", { headers: { "x-api-key": key, "anthropic-version": "2023-06-01" } });
      if (!r.ok) return null;
      const j: any = await r.json();
      return (j.data ?? []).map((m: any) => String(m.id)).filter(isModelId);
    }
    if (provider === "openai") {
      const r = await fetch("https://api.openai.com/v1/models", { headers: { authorization: `Bearer ${key}` } });
      if (!r.ok) return null;
      const j: any = await r.json();
      return (j.data ?? [])
        .map((m: any) => String(m.id))
        .filter((id: string) => isModelId(id) && /^(gpt-|o\d|chatgpt-)/.test(id) && !/(audio|realtime|tts|transcribe|image|search|embedding|moderation|codex|instruct)/.test(id))
        .sort();
    }
    const r = await fetch("https://openrouter.ai/api/v1/models");
    if (!r.ok) return null;
    const j: any = await r.json();
    return (j.data ?? [])
      .filter((m: any) => Array.isArray(m.supported_parameters) && m.supported_parameters.includes("tools"))
      .map((m: any) => String(m.id))
      .filter(isModelId)
      .sort();
  } catch {
    return null;
  }
}
