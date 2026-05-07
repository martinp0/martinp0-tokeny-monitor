import { corsHeaders } from "@supabase/supabase-js/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token || token.length < 10) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find shared dashboard
    const { data: share, error: shareError } = await supabase
      .from("shared_dashboards")
      .select("*")
      .eq("share_token", token)
      .maybeSingle();

    if (shareError || !share) {
      return new Response(JSON.stringify({ error: "Share not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check expiry
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Share expired" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch activity data for the user
    const { data: rows, error: rowsError } = await supabase
      .from("activity_rows")
      .select("*")
      .eq("user_id", share.user_id)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (rowsError) {
      return new Response(JSON.stringify({ error: rowsError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get profile for display name
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", share.user_id)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        label: share.label,
        filters: share.filters,
        owner: profile?.display_name || "Anonym",
        created_at: share.created_at,
        rows: rows || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
