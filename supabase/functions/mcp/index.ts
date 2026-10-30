import { createClient } from "@supabase/supabase-js";
import { isProSubscription } from "../_shared/plan.ts";
import { createMcpApp } from "./app.ts";

// Tokens are sha256 hashes (matched against mcp_tokens.token_hash).
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function svc() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function userIsPro(userId: string): Promise<boolean> {
  const { data, error } = await svc()
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) console.error("mcp: subscription lookup failed", error.message);
  return isProSubscription(data);
}

async function authUser(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const hash = await sha256Hex(m[1].trim());
  const supabase = svc();
  const { data } = await supabase.from("mcp_tokens").select("user_id").eq("token_hash", hash).maybeSingle();
  if (!data) return null;
  await supabase.from("mcp_tokens").update({ last_used_at: new Date().toISOString() }).eq("token_hash", hash);
  return data.user_id;
}

Deno.serve(createMcpApp({ authUser, userIsPro, db: svc }).fetch);
