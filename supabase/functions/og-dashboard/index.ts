// Dynamic OG image for shared dashboards.
// GET /og-dashboard?token=<share_token>
//   - if user has uploaded a custom og_image_path -> 302 redirect to public URL
//   - otherwise renders an SVG with KPI summary (Content-Type: image/svg+xml)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeXml(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function fmtUsd(v: number) {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toFixed(2)}`;
}
function fmtCount(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
}

function buildSvg(opts: {
  label: string;
  owner: string;
  totalCost: number;
  totalRequests: number;
  totalTokens: number;
  topModel: string;
}) {
  const { label, owner, totalCost, totalRequests, totalTokens, topModel } = opts;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a0b2e"/>
      <stop offset="55%" stop-color="#581c87"/>
      <stop offset="100%" stop-color="#0f766e"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#a855f7"/>
      <stop offset="50%" stop-color="#ec4899"/>
      <stop offset="100%" stop-color="#14b8a6"/>
    </linearGradient>
    <radialGradient id="orb1" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ec4899" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#ec4899" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="orb2" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#14b8a6" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#14b8a6" stop-opacity="0"/>
    </radialGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="2"/></filter>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1050" cy="120" r="260" fill="url(#orb1)"/>
  <circle cx="120"  cy="540" r="240" fill="url(#orb2)"/>

  <!-- mesh grid -->
  <g stroke="#ffffff" stroke-opacity="0.05" stroke-width="1">
    ${Array.from({ length: 12 }, (_, i) => `<line x1="${i * 100}" y1="0" x2="${i * 100}" y2="630"/>`).join("")}
    ${Array.from({ length: 7 }, (_, i) => `<line x1="0" y1="${i * 100}" x2="1200" y2="${i * 100}"/>`).join("")}
  </g>

  <!-- header pill -->
  <g transform="translate(60,60)">
    <rect width="320" height="44" rx="22" fill="#ffffff" fill-opacity="0.08" stroke="#ffffff" stroke-opacity="0.15"/>
    <circle cx="24" cy="22" r="6" fill="url(#accent)"/>
    <text x="44" y="29" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI" font-size="18" fill="#ffffff" fill-opacity="0.85" font-weight="600">SHARED DASHBOARD · read-only</text>
  </g>

  <!-- title -->
  <text x="60" y="200" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI" font-size="68" font-weight="800" fill="#ffffff" letter-spacing="-2">${escapeXml(label || "Sdílený dashboard")}</text>
  <text x="60" y="248" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="22" fill="#ffffff" fill-opacity="0.65">od ${escapeXml(owner)} · OpenRouter Monitor</text>

  <!-- KPI cards -->
  <g transform="translate(60,310)">
    ${[
      { label: "Náklady", value: fmtUsd(totalCost) },
      { label: "Requesty", value: fmtCount(totalRequests) },
      { label: "Tokeny", value: fmtCount(totalTokens) },
    ]
      .map(
        (k, i) => `
    <g transform="translate(${i * 360},0)">
      <rect width="340" height="170" rx="22" fill="#ffffff" fill-opacity="0.06" stroke="#ffffff" stroke-opacity="0.12"/>
      <text x="28" y="50" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="16" fill="#ffffff" fill-opacity="0.55" letter-spacing="2">${k.label.toUpperCase()}</text>
      <text x="28" y="125" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI" font-size="64" font-weight="800" fill="#ffffff">${escapeXml(k.value)}</text>
    </g>`,
      )
      .join("")}
  </g>

  <!-- footer -->
  <g transform="translate(60,540)">
    <text font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="20" fill="#ffffff" fill-opacity="0.7">TOP MODEL · <tspan fill="#ffffff" font-weight="700">${escapeXml(topModel || "—")}</tspan></text>
  </g>
  <g transform="translate(900,540)">
    <rect width="240" height="44" rx="22" fill="url(#accent)"/>
    <text x="120" y="29" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI" font-size="18" font-weight="700" fill="#0f0a1f">tokeny.pohl.uk</text>
  </g>
</svg>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token || token.length < 10) {
      return new Response("Invalid token", { status: 400, headers: cors });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: share } = await supabase
      .from("shared_dashboards")
      .select("user_id, label, og_image_path, expires_at")
      .eq("share_token", token)
      .maybeSingle();

    if (!share) return new Response("Not found", { status: 404, headers: cors });
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return new Response("Expired", { status: 410, headers: cors });
    }

    // Custom uploaded image -> redirect to its public URL
    if (share.og_image_path) {
      const { data: pub } = supabase.storage.from("og-images").getPublicUrl(share.og_image_path);
      if (pub?.publicUrl) {
        return Response.redirect(pub.publicUrl, 302);
      }
    }

    // Otherwise compute KPIs and render SVG
    const { data: rows } = await supabase
      .from("activity_rows")
      .select("cost_total, tokens_prompt, tokens_completion, model_permaslug")
      .eq("user_id", share.user_id)
      .limit(5000);

    let totalCost = 0;
    let totalTokens = 0;
    const modelMap: Record<string, number> = {};
    (rows || []).forEach((r: any) => {
      totalCost += Number(r.cost_total || 0);
      totalTokens += Number(r.tokens_prompt || 0) + Number(r.tokens_completion || 0);
      const m = r.model_permaslug || "unknown";
      modelMap[m] = (modelMap[m] || 0) + Number(r.cost_total || 0);
    });
    const topModel = (Object.entries(modelMap).sort((a, b) => b[1] - a[1])[0]?.[0] || "")
      .split("/")
      .pop() || "—";

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", share.user_id)
      .maybeSingle();

    const svg = buildSvg({
      label: share.label || "Sdílený dashboard",
      owner: profile?.display_name || "Anonym",
      totalCost,
      totalRequests: rows?.length || 0,
      totalTokens,
      topModel,
    });

    return new Response(svg, {
      headers: {
        ...cors,
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=600",
      },
    });
  } catch (e) {
    return new Response(`Error: ${(e as Error).message}`, { status: 500, headers: cors });
  }
});
