// SECURITY HOTFIX: this function used to call OpenRouter with ONE shared, server-wide API key
// (OPENROUTER_API_KEY) for every signed-in caller, so any account could import the key owner's
// OpenRouter activity, and its upsert on the globally unique generation_id could re-assign another
// user's rows to the caller. It is disabled until the per-user implementation from PR #12 is deployed.
// It never reads OPENROUTER_API_KEY and never touches the database.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return new Response(
    JSON.stringify({
      error: "sync_disabled",
      message: "Synchronizace OpenRouteru je dočasně vypnutá. Data můžeš dál nahrát přes CSV export.",
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
