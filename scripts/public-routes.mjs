/**
 * Public, indexable routes. Single source for the prerender and sitemap.xml.
 * Keep in sync with <AppRoutes /> in src/App.tsx.
 */
export const SITE_URL = "https://tokeny.martinpohl.cz";

export const PUBLIC_ROUTES = [
  { path: "/", lastmod: "2026-10-30", changefreq: "weekly", priority: "1.0", alternates: true },
  { path: "/llm-cost-calculator", lastmod: "2026-10-30", changefreq: "weekly", priority: "0.9" },
  { path: "/claude-api-cost", lastmod: "2026-10-30", changefreq: "monthly", priority: "0.8" },
  { path: "/gpt-api-cost", lastmod: "2026-10-30", changefreq: "monthly", priority: "0.8" },
  { path: "/how-to-calculate-llm-cost", lastmod: "2026-10-30", changefreq: "monthly", priority: "0.7" },
  { path: "/blog", lastmod: "2026-10-30", changefreq: "weekly", priority: "0.7" },
  { path: "/blog/ai-cost-saving", lastmod: "2026-05-19", changefreq: "monthly", priority: "0.7" },
  { path: "/blog/prompt-optimization", lastmod: "2026-05-19", changefreq: "monthly", priority: "0.7" },
  { path: "/blog/token-window", lastmod: "2026-05-19", changefreq: "monthly", priority: "0.7" },
  { path: "/blog/gpt-vs-claude-vs-gemini", lastmod: "2026-05-25", changefreq: "monthly", priority: "0.7" },
  { path: "/blog/monitoring-ai-costs", lastmod: "2026-05-25", changefreq: "monthly", priority: "0.7" },
  { path: "/blog/multi-provider-monitoring", lastmod: "2026-10-30", changefreq: "monthly", priority: "0.8" },
  { path: "/blog/grok-token-optimization", lastmod: "2026-10-07", changefreq: "monthly", priority: "0.8" },
  { path: "/privacy", lastmod: "2026-10-30", changefreq: "yearly", priority: "0.3" },
];

export function buildSitemap() {
  const urls = PUBLIC_ROUTES.map((r) => {
    const loc = `${SITE_URL}${r.path}`;
    const alt = r.alternates
      ? `\n    <xhtml:link rel="alternate" hreflang="cs" href="${loc}" />` +
        `\n    <xhtml:link rel="alternate" hreflang="en" href="${loc}?lang=en" />` +
        `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${loc}" />`
      : "";
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${r.lastmod}</lastmod>\n    <changefreq>${r.changefreq}</changefreq>\n    <priority>${r.priority}</priority>${alt}\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`;
}
