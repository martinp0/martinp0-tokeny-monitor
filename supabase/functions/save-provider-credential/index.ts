// Save (insert/update) a per-user API credential for OpenRouter / Anthropic / OpenAI.
//
// The browser never sends the api_key directly into a row — we route through this
// edge function so the api_key column stays unreadable from the client (see
// migration 20260508120000_multi_provider.sql for column-level GRANTs).
//
// Body: { provider: 'openrouter' | 'anthropic' | 'openai', label?: string, api_key: string, organization_id?: string }
// Returns: { id, provider, label, key_preview, enabled, last_synced_at }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_PROVIDERS = new Set(["openrouter", "anthropic", "openai"]);

function preview(key: string): string {
  if (!key) return "";
  const trimmed = key.trim();
  if (trimmed.length <= 10) return "****" + trimmed.slice(-2);
  return trimmed.slice(0, 4) + "…" + trimmed.slice(-4);
}

function validateKeyShape(provider: string, key: string): string | null {
  const k = key.trim();
  if (!k) return "API key is empty";
  if (k.length < 16) return "API key seems too short";
  if (provider === "anthropic" && !k.startsWith("sk-ant-"))
    return "Anthropic Admin keys typically start with sk-ant-";
  if (provider === "openai" && !k.startsWith("sk-"))
    return "OpenAI keys typically start with sk-";
  if (provider === "openrouter" && !k.startsWith("sk-or-"))
    return "OpenRouter keys typically start with sk-or-";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const provider = String(body.provider ?? "").toLowerCase();
    const label = (body.label ?? "Default").toString().slice(0, 60);
    const apiKey = String(body.api_key ?? "").trim();
    const organizationId = body.organization_id ? String(body.organization_id).slice(0, 120) : null;

    if (!ALLOWED_PROVIDERS.has(provider)) {
      return new Response(JSON.stringify({ error: "Unsupported provider" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const shapeError = validateKeyShape(provider, apiKey);
    if (shapeError) {
      return new Response(JSON.stringify({ error: shapeError }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Upsert by (user_id, provider, label) — overwrite if user re-saves with same label.
    const row = {
      user_id: userRes.user.id,
      provider,
      label,
      api_key: apiKey,
      key_preview: preview(apiKey),
      organization_id: organizationId,
      enabled: true,
      last_sync_status: null,
      last_sync_error: null,
    };

    const { data, error } = await svc
      .from("provider_credentials")
      .upsert(row, { onConflict: "user_id,provider,label" })
      .select("id, provider, label, key_preview, enabled, organization_id, last_synced_at")
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ credential: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("save-provider-credential error", e);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
