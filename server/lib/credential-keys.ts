// Masking + shape validation for provider API keys (pure; unit-tested).

/** Bullets + last 4 characters; never more of the key. */
export function maskKey(key: string): string {
  const k = key.trim();
  if (!k) return "";
  if (k.length < 12) return "••••";
  return "••••" + k.slice(-4);
}

/** Only providers with a working sync (keep in sync with SUPPORTED_SYNC_PROVIDERS + the DB CHECK). */
export const ALLOWED_PROVIDERS = new Set(["openrouter", "anthropic", "openai"]);

export function validateKeyShape(provider: string, key: string): string | null {
  const k = key.trim();
  if (!k) return "API key is empty";
  if (k.length < 12) return "API key seems too short";
  if (provider === "anthropic" && !k.startsWith("sk-ant-")) return "Anthropic Admin keys typically start with sk-ant-";
  if (provider === "openai" && !k.startsWith("sk-")) return "OpenAI keys typically start with sk-";
  if (provider === "openrouter" && !k.startsWith("sk-or-")) return "OpenRouter Management keys typically start with sk-or-";
  return null;
}

export class MissingKeyError extends Error {
  constructor() {
    super("No API key stored for this connection. Save the key again in Settings.");
  }
}

/** Providers the user can store an own AI key for (keep in sync with the ai_keys CHECK). */
export const AI_KEY_PROVIDERS = new Set(["anthropic"]);

/**
 * The user's own key for the AI features. Must be a normal Anthropic API key: Admin keys
 * (sk-ant-admin…, used for usage sync) cannot call the Messages API.
 */
export function validateAiKeyShape(provider: string, key: string): string | null {
  const k = key.trim();
  if (!AI_KEY_PROVIDERS.has(provider)) return "Unsupported AI provider";
  if (!k) return "API klíč je prázdný.";
  if (/\s/.test(k)) return "API klíč nesmí obsahovat mezery.";
  if (k.length < 20 || k.length > 300) return "API klíč nemá správnou délku.";
  if (k.startsWith("sk-ant-admin")) return "Admin klíč neumí volat AI. Vytvoř si běžný API klíč v console.anthropic.com.";
  if (!k.startsWith("sk-ant-")) return "Klíč Anthropic začíná na sk-ant-.";
  return null;
}
