// Shared stub for providers without a public per-key usage API.
// Validates ownership of the credential, sets last_sync_status='error' with a
// helpful message guiding the user to use CSV upload instead.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export async function handleStubSync(
  req: Request,
  expectedProvider: string,
  providerLabel: string,
) {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
  const credentialId = String(body.credential_id ?? "");
  if (!credentialId) {
    return new Response(JSON.stringify({ error: "credential_id is required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: cred } = await svc.from("provider_credentials")
    .select("id, provider, user_id")
    .eq("id", credentialId).eq("user_id", userRes.user.id).single();

  if (!cred || cred.provider !== expectedProvider) {
    return new Response(JSON.stringify({ error: "Credential not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const msg = `${providerLabel} zatím nemá veřejné per-key usage API. Použij CSV upload pro import historických dat.`;

  await svc.from("provider_credentials").update({
    last_sync_status: "error",
    last_sync_error: msg,
    last_synced_at: new Date().toISOString(),
  }).eq("id", credentialId);

  return new Response(JSON.stringify({ error: msg, inserted: 0 }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
