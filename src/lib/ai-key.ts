import { ApiError } from "@/lib/api";

export type AiProviderId = "anthropic" | "openai" | "openrouter";

/** One of the user's own AI keys as the server describes it (masked; never the key itself). */
export interface AiKeyInfo {
  provider: AiProviderId;
  key_preview: string;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Provider catalog sent by the server (GET /api/ai-key). */
export interface AiProviderInfo {
  id: AiProviderId;
  label: string;
  keysUrl: string;
  billingUrl: string;
  keyPrefix: string;
  defaultModel: string;
  models: { id: string; label: string }[];
}

export interface AiActive { provider: AiProviderId; model: string }

export interface AiKeyState {
  keys: AiKeyInfo[];
  active: AiActive | null;
  providers: AiProviderInfo[];
}

/** Static fallback for links when the catalog is not loaded (mirrors server/ai-providers.ts). */
export const PROVIDER_LINKS: Record<AiProviderId, { label: string; keysUrl: string; billingUrl: string; host: string }> = {
  anthropic: { label: "Anthropic", keysUrl: "https://console.anthropic.com/settings/keys", billingUrl: "https://console.anthropic.com/settings/billing", host: "console.anthropic.com" },
  openai: { label: "OpenAI", keysUrl: "https://platform.openai.com/api-keys", billingUrl: "https://platform.openai.com/settings/organization/billing/overview", host: "platform.openai.com" },
  openrouter: { label: "OpenRouter", keysUrl: "https://openrouter.ai/settings/keys", billingUrl: "https://openrouter.ai/settings/credits", host: "openrouter.ai" },
};

export const isProviderId = (p: unknown): p is AiProviderId => p === "anthropic" || p === "openai" || p === "openrouter";

export type AiKeyProblem = "missing" | "invalid" | "no_credit" | "model";

export interface AiKeyIssue { problem: AiKeyProblem; provider: AiProviderId | null }

/** Map an AI endpoint error to an empty-state reason (+ provider), or null for other errors. */
export function aiKeyIssue(e: unknown): AiKeyIssue | null {
  if (!(e instanceof ApiError)) return null;
  const code = e.body?.code;
  const provider = isProviderId(e.body?.provider) ? e.body.provider : null;
  const problem: AiKeyProblem | null =
    code === "ai_key_missing" ? "missing"
    : code === "ai_key_invalid" ? "invalid"
    : code === "ai_key_no_credit" ? "no_credit"
    : code === "ai_model_unavailable" ? "model"
    : null;
  return problem ? { problem, provider } : null;
}
