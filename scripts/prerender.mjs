import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const dist = path.resolve("dist");
const templatePath = path.join(dist, "index.html");
let template = fs.readFileSync(templatePath, "utf8");
const shellTemplate = template; // un-rendered SPA shell, used for the static blog pages below

const assetsDir = path.join(dist, "assets");
const preloads = new Set();
if (fs.existsSync(assetsDir)) {
  for (const file of fs.readdirSync(assetsDir)) {
    if (!file.endsWith(".css")) continue;
    const css = fs.readFileSync(path.join(assetsDir, file), "utf8");
    const re = /url\((?:['"]?)([^)'"]*space-grotesk-latin(?:-ext)?-700-normal[^)'"]+\.woff2)(?:['"]?)\)/g;
    let match;
    while ((match = re.exec(css))) {
      let href = match[1];
      if (href.startsWith("./")) href = "/assets/" + href.slice(2);
      if (!href.startsWith("/")) href = "/assets/" + href;
      preloads.add(href);
    }
  }
}

if (preloads.size) {
  const tags = [...preloads]
    .map((href) => `<link rel="preload" as="font" type="font/woff2" href="${href}" crossorigin />`)
    .join("\n    ");
  template = template.replace("</head>", `    ${tags}\n  </head>`);
} else {
  console.warn("prerender: no Space Grotesk 700 woff2 found to preload");
}

const serverEntry = pathToFileURL(path.join(dist, "server", "entry-server.js")).href;
const { render, renderPage, PRERENDER_PAGES } = await import(serverEntry);
const appHtml = render("/");
if (!appHtml.includes("Zjisti, kolik tě")) {
  throw new Error("prerender: landing heading missing from SSR output");
}
if (!template.includes('<div id="root"></div>')) {
  throw new Error("prerender: #root placeholder missing");
}
template = template.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`);
fs.writeFileSync(templatePath, template);
console.log(`prerendered / (${appHtml.length} chars, ${preloads.size} font preloads)`);

// ── Static blog pages: own head (title, description, canonical, OG) per URL ──
const HEAD_TAG_RE = [
  /\s*<title>[\s\S]*?<\/title>/g,
  /\s*<meta\s+name="(?:description|keywords|twitter:title|twitter:description)"[^>]*>/g,
  /\s*<meta\s+property="(?:og:title|og:description|og:url|og:type|article:[^"]*)"[^>]*>/g,
  /\s*<link\s+rel="(?:canonical|alternate)"[^>]*>/g,
];
// Font preloads apply to every page.
let pageShell = shellTemplate;
if (preloads.size) {
  const tags = [...preloads]
    .map((href) => `<link rel="preload" as="font" type="font/woff2" href="${href}" crossorigin />`)
    .join("\n    ");
  pageShell = pageShell.replace("</head>", `    ${tags}\n  </head>`);
}
for (const url of Object.keys(PRERENDER_PAGES)) {
  const { html, head } = renderPage(url);
  if (!head.includes('rel="canonical"') || !head.includes("og:title")) {
    throw new Error(`prerender: ${url} is missing canonical/og tags`);
  }
  let page = pageShell;
  for (const re of HEAD_TAG_RE) page = page.replace(re, "");
  page = page.replace("</head>", `    ${head}\n  </head>`);
  page = page.replace('<div id="root"></div>', `<div id="root">${html}</div>`);
  const out = path.join(dist, url.replace(/^\//, ""), "index.html");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, page);
  console.log(`prerendered ${url} (${html.length} chars)`);
}
