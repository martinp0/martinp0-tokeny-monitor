import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { mode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    if (mode === "joke") {
      const response = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content:
                  "Jsi vtipný český komik. Generuj originální, krátké vtipy v češtině. Můžeš dělat vtipy o programování, AI, technologiích, nebo obecné vtipy. Buď kreativní a překvapivý. Vrať POUZE vtip, nic jiného. Žádné uvozovky, žádné komentáře.",
              },
              {
                role: "user",
                content: "Vygeneruj jeden krátký vtip.",
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        const status = response.status;
        if (status === 429)
          return new Response(
            JSON.stringify({ error: "Příliš mnoho požadavků, zkus to za chvíli." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        if (status === 402)
          return new Response(
            JSON.stringify({ error: "Nedostatek kreditů." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        throw new Error(`AI gateway error: ${status}`);
      }

      const data = await response.json();
      const joke = data.choices?.[0]?.message?.content || "Žádný vtip se nenašel 😢";
      return new Response(JSON.stringify({ joke }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "image") {
      const response = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3.1-flash-image-preview",
            messages: [
              {
                role: "user",
                content:
                  "Generate a funny, absurd, colorful cartoon image. It should be quirky and humorous — something like a cat coding on a laptop, a robot eating pizza, or a penguin DJing at a party. Be creative and random. No text in the image.",
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        const status = response.status;
        if (status === 429)
          return new Response(
            JSON.stringify({ error: "Příliš mnoho požadavků, zkus to za chvíli." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        if (status === 402)
          return new Response(
            JSON.stringify({ error: "Nedostatek kreditů." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        throw new Error(`AI gateway error: ${status}`);
      }

      const data = await response.json();
      const parts = data.choices?.[0]?.message?.content;

      // The image model may return inline_data in parts
      let imageData = null;
      let textContent = null;

      if (Array.isArray(parts)) {
        for (const part of parts) {
          if (part.type === "image_url" && part.image_url?.url) {
            imageData = part.image_url.url;
          } else if (part.type === "text") {
            textContent = part.text;
          }
        }
      } else if (typeof parts === "string") {
        textContent = parts;
      }

      // Check for inline_data in the raw response
      const rawParts = data.choices?.[0]?.message?.parts;
      if (!imageData && Array.isArray(rawParts)) {
        for (const part of rawParts) {
          if (part.inline_data) {
            imageData = `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`;
          }
        }
      }

      return new Response(
        JSON.stringify({ image: imageData, text: textContent }),
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
