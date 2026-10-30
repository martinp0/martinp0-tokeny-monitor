/**
 * Static prerender for Vercel.
 *
 *  dist/index.html                 → "/" (landing)
 *  dist/<route>.html               → every other public route (served via cleanUrls)
 *  dist/404.html                   → NotFound, noindex (Vercel returns it with a real 404 status)
 *  dist/app.html                   → empty SPA shell for app routes (/auth, /dashboard, …), noindex
 *  dist/sitemap.xml                → generated from scripts/public-routes.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PUBLIC_ROUTES, SITE_URL, buildSitemap } from "./public-routes.mjs";

const dist = path.resolve("dist");
const template = fs.readFileSync(path.join(dist, "index.html"), "utf8");

const HEAD_RE = /<!--route-head-->[\s\S]*?<!--\/route-head-->/;
if (!HEAD_RE.test(template)) throw new Error("prerender: <!--route-head--> block missing in index.html");
if (!template.includes('<div id="root"></div>')) throw new Error("prerender: #root placeholder missing");

const { render } = await import(pathToFileURL(path.join(dist, "server", "entry-server.js")).href);

const attr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const pick = (head, re) => (head.match(re) || [])[1];

/** Fill og/twitter fallbacks from the route's own title/description. */
function socialFallbacks(head) {
  const extra = [];
  const title = pick(head, /<title[^>]*>([^<]*)<\/title>/);
  const desc = pick(head, /<meta[^>]*name="description"[^>]*content="([^"]*)"/);
  if (title && !/property="og:title"/.test(head)) extra.push(`<meta property="og:title" content="${title}" />`);
  if (desc && !/property="og:description"/.test(head)) extra.push(`<meta property="og:description" content="${desc}" />`);
  if (title) extra.push(`<meta name="twitter:title" content="${title}" />`);
  if (desc) extra.push(`<meta name="twitter:description" content="${desc}" />`);
  return extra.join("\n    ");
}

function page({ route, head, html, htmlAttributes = "" }) {
  let out = template.replace(HEAD_RE, head);
  out = out.replace('<div id="root"></div>', `<div id="root">${html}</div>`);
  // route === null → no data-route: hydrate whatever path we're served on (404 page).
  const extraAttrs = [route === null ? "" : `data-route="${attr(route)}"`, htmlAttributes].filter(Boolean).join(" ");
  if (extraAttrs) out = out.replace(/<html([^>]*)>/, `<html$1 ${extraAttrs}>`);
  return out;
}

function write(file, contents) {
  const full = path.join(dist, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents);
}

for (const { path: route } of PUBLIC_ROUTES) {
  const { html, head, htmlAttributes } = await render(route);
  if (!/<title[^>]*>[^<]+<\/title>/.test(head)) throw new Error(`prerender: ${route} has no <title>`);
  if (!head.includes(`rel="canonical" href="${SITE_URL}${route === "/" ? "/" : route}"`)) {
    throw new Error(`prerender: ${route} canonical missing or not on ${SITE_URL}`);
  }
  if (html.includes('role="status" aria-label="Načítání"')) {
    throw new Error(`prerender: ${route} rendered the loading fallback instead of content`);
  }
  if (route === "/" && !html.includes("opravdu stojí")) throw new Error("prerender: landing hero missing");
  const fullHead = [head, socialFallbacks(head)].filter(Boolean).join("\n    ");
  const file = route === "/" ? "index.html" : `${route.slice(1)}.html`;
  write(file, page({ route, head: fullHead, html, htmlAttributes }));
  console.log(`prerendered ${route} → ${file} (${html.length} chars)`);
}

// 404 page — real 404 status on Vercel for unknown paths.
{
  const { html, head, htmlAttributes } = await render("/__not-found__");
  if (!head.includes("noindex")) throw new Error("prerender: 404 page must be noindex");
  write("404.html", page({ route: null, head, html, htmlAttributes }));
  console.log("prerendered 404.html");
}

// Empty client-side shell for app routes.
write(
  "app.html",
  page({
    route: "",
    head: '<title>Tokeny</title>\n    <meta name="robots" content="noindex" />',
    html: "",
  }),
);
console.log("wrote app.html shell");

write("sitemap.xml", buildSitemap());
console.log(`wrote sitemap.xml (${PUBLIC_ROUTES.length} urls)`);
