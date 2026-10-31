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
