import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: alerts } = await supabase
      .from("budget_alerts")
      .select("*")
      .eq("enabled", true);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const results: any[] = [];

    for (const alert of alerts ?? []) {
      const { data: rows } = await supabase
        .from("activity_rows")
        .select("cost_total")
        .gte("created_at", monthStart.toISOString().substring(0, 10));

      const monthCost = (rows ?? []).reduce((s, r: any) => s + r.cost_total, 0);
      const pct = (monthCost / Number(alert.monthly_budget_usd)) * 100;

      const shouldNotify =
        pct >= alert.threshold_pct &&
        (!alert.last_notified_at ||
          new Date(alert.last_notified_at).getMonth() !== new Date().getMonth());

      results.push({
        id: alert.id,
        budget_usd: Number(alert.monthly_budget_usd),
        spent_usd: +monthCost.toFixed(4),
        pct: +pct.toFixed(1),
        should_notify: shouldNotify,
      });

      if (shouldNotify) {
        await supabase
          .from("budget_alerts")
          .update({ last_notified_at: new Date().toISOString() })
          .eq("id", alert.id);
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "err" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
