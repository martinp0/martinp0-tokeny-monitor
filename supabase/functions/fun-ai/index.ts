import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const mode = typeof body?.mode === "string" ? body.mode : "";
    if (!["joke", "image"].includes(mode)) {
      return new Response(JSON.stringify({ error: "Invalid mode" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    if (mode === "joke") {
      const response = await fetch(ANTHROPIC_API, {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 256,
          system:
            "Jsi vtipný český komik. Generuj originální, krátké vtipy v češtině. Můžeš dělat vtipy o programování, AI, technologiích, nebo obecné vtipy. Buď kreativní a překvapivý. Vrať POUZE vtip, nic jiného. Žádné uvozovky, žádné komentáře.",
          messages: [{ role: "user", content: "Vygeneruj jeden krátký vtip." }],
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429)
          return new Response(
            JSON.stringify({ error: "Příliš mnoho požadavků, zkus to za chvíli." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        throw new Error(`Anthropic API error: ${status}`);
      }

      const data = await response.json();
      const joke = data.content?.[0]?.text || "Žádný vtip se nenašel 😢";
      return new Response(JSON.stringify({ joke }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "image") {
      // Generate a creative prompt via Claude, then fetch the image from Pollinations.ai
      const promptResp = await fetch(ANTHROPIC_API, {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 128,
          system:
            "Generate a short, vivid English image prompt (max 20 words) for a funny, absurd cartoon scene. Be creative and surprising. Reply with ONLY the prompt, no quotes, no explanation.",
          messages: [{ role: "user", content: "Generate one funny image prompt." }],
        }),
      });

      let prompt = "a cat coding on a laptop while drinking coffee";
      if (promptResp.ok) {
        const pd = await promptResp.json();
        prompt = pd.content?.[0]?.text?.trim() || prompt;
      }

      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&model=flux&width=512&height=512`;

      return new Response(
        JSON.stringify({ image: imageUrl, text: prompt }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid mode" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fun-ai error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
