import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const dist = path.resolve("dist");
const templatePath = path.join(dist, "index.html");
let template = fs.readFileSync(templatePath, "utf8");

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
const { render } = await import(serverEntry);
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
