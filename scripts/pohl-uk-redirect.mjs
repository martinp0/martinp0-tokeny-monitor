#!/usr/bin/env node
// Turns the tokeny.pohl.uk → tokeny.martinpohl.cz 301 redirect on/off in vercel.json.
//   node scripts/pohl-uk-redirect.mjs --status    (default) prints on/off
//   node scripts/pohl-uk-redirect.mjs --enable    adds the redirect (idempotent)
//   node scripts/pohl-uk-redirect.mjs --disable   removes it
// Static vercel.json can't read env vars, so the "flag" is this explicit, reviewable commit.
// Checklist before --enable: docs/domain-redirect.md.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const LEGACY_HOST = "tokeny.pohl.uk";

export function loadRedirect(dir = root) {
  return JSON.parse(readFileSync(join(dir, "ci/vercel-redirect-pohl-uk.json"), "utf8")).redirect;
}

const isOurs = (r) => r?.has?.some((h) => h.type === "host" && h.value === LEGACY_HOST);

export function isEnabled(config) {
  return (config.redirects ?? []).some(isOurs);
}

export function enable(config, redirect) {
  const others = (config.redirects ?? []).filter((r) => !isOurs(r));
  // Put it first: redirects run before rewrites/filesystem, and it must win over every other rule.
  const out = { ...config, redirects: [redirect, ...others] };
  // Keep key order readable: $schema, cleanUrls, trailingSlash, redirects, rewrites, headers…
  const { $schema, cleanUrls, trailingSlash, redirects, ...rest } = out;
  return { $schema, cleanUrls, trailingSlash, redirects, ...rest };
}

export function disable(config) {
  const others = (config.redirects ?? []).filter((r) => !isOurs(r));
  const { redirects: _drop, ...rest } = config;
  return others.length ? { ...rest, redirects: others } : rest;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const file = join(root, "vercel.json");
  const config = JSON.parse(readFileSync(file, "utf8"));
  const mode = process.argv[2] ?? "--status";
  if (mode === "--status") {
    console.log(`pohl.uk redirect: ${isEnabled(config) ? "ENABLED" : "disabled"}`);
  } else if (mode === "--enable" || mode === "--disable") {
    const next = mode === "--enable" ? enable(config, loadRedirect()) : disable(config);
    writeFileSync(file, JSON.stringify(next, null, 2) + "\n");
    console.log(`pohl.uk redirect: ${isEnabled(next) ? "ENABLED" : "disabled"} (vercel.json updated — commit + deploy to apply)`);
  } else {
    console.error("usage: node scripts/pohl-uk-redirect.mjs [--status|--enable|--disable]");
    process.exit(2);
  }
}
