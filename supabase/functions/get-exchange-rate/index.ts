import { corsHeaders } from "@supabase/supabase-js/cors";

const CNB_URL = "https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const res = await fetch(CNB_URL);
    if (!res.ok) {
      throw new Error(`CNB API returned ${res.status}`);
    }

    const text = await res.text();
    // Format: lines like "USA|dolar|1|USD|23,455"
    const lines = text.split("\n");
    let rate = 23.5; // fallback

    for (const line of lines) {
      const parts = line.split("|");
      if (parts.length >= 5 && parts[3]?.trim() === "USD") {
        const amount = parseInt(parts[2]?.trim() || "1", 10);
        const value = parseFloat(parts[4]?.trim().replace(",", ".") || "0");
        rate = value / amount;
        break;
      }
    }

    return new Response(JSON.stringify({ rate, date: lines[0]?.trim() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching CNB rate:", message);
    return new Response(JSON.stringify({ error: message, rate: 23.5 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200, // still return fallback
    });
  }
});
