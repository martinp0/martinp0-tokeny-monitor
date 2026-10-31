import { ApiError } from "@/lib/api";

/** The user's own Anthropic key as the server describes it (masked; never the key itself). */
export interface AiKeyInfo {
  provider: "anthropic";
  key_preview: string;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export const ANTHROPIC_KEYS_URL = "https://console.anthropic.com/settings/keys";

export type AiKeyProblem = "missing" | "invalid" | "no_credit";

/** Map an AI endpoint error to an empty-state reason, or null for other errors. */
export function aiKeyProblem(e: unknown): AiKeyProblem | null {
  if (!(e instanceof ApiError)) return null;
  const code = e.body?.code;
  if (code === "ai_key_missing") return "missing";
  if (code === "ai_key_invalid") return "invalid";
  if (code === "ai_key_no_credit") return "no_credit";
  return null;
}
