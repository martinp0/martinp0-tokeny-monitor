import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CNB_URL = "https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Fetch rate from ČNB
    const res = await fetch(CNB_URL);
    if (!res.ok) throw new Error(`CNB API returned ${res.status}`);

    const text = await res.text();
    const lines = text.split("\n");
    let rate = 23.5;
    let sourceDate = lines[0]?.trim() || null;

    for (const line of lines) {
      const parts = line.split("|");
      if (parts.length >= 5 && parts[3]?.trim() === "USD") {
        const amount = parseInt(parts[2]?.trim() || "1", 10);
        const value = parseFloat(parts[4]?.trim().replace(",", ".") || "0");
        rate = value / amount;
        break;
      }
    }

    // Store in DB
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase
      .from("exchange_rates")
      .upsert(
        { currency_pair: "USD_CZK", rate, source_date: sourceDate, fetched_at: new Date().toISOString() },
        { onConflict: "currency_pair" }
      );

    return new Response(JSON.stringify({ rate, date: sourceDate, cached: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching CNB rate:", message);
    return new Response(JSON.stringify({ error: message, rate: 23.5 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
