import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.49.4/cors";

const OPENROUTER_API = "https://openrouter.ai/api/v1/activity";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENROUTER_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch activity from OpenRouter (last 30 days aggregated by endpoint)
    const response = await fetch(OPENROUTER_API, {
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: `OpenRouter API error [${response.status}]: ${errorText}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    const items = result.data || [];

    // The /activity endpoint returns aggregated data per model/provider/date
    // We store each item as a row
    let inserted = 0;
    let skipped = 0;

    for (const item of items) {
      const generationId = `${item.date}_${item.model_permaslug}_${item.endpoint_id || ""}`;

      const { error } = await supabase.from("activity_rows").upsert(
        {
          generation_id: generationId,
          created_at: item.date || "",
          cost_total: item.usage || 0,
          tokens_prompt: item.prompt_tokens || 0,
          tokens_completion: item.completion_tokens || 0,
          tokens_reasoning: item.reasoning_tokens || 0,
          tokens_cached: item.cached_tokens || 0,
          model_permaslug: item.model_permaslug || "",
          provider_name: item.provider_name || "",
        },
        { onConflict: "generation_id" }
      );

      if (error) {
        console.error("Insert error:", error);
        skipped++;
      } else {
        inserted++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, total: items.length, inserted, skipped }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
