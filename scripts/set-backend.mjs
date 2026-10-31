#!/usr/bin/env node
// Points the whole repo at a Supabase project in one go (used for the move off Lovable Cloud).
//
//   node scripts/set-backend.mjs <project-ref> <publishable-or-anon-key>
//
// Rewrites every place that names the backend:
//   .env                                VITE_SUPABASE_PROJECT_ID / _URL / _PUBLISHABLE_KEY
//   supabase/config.toml                project_id
//   vercel.json                         /api/* rewrites to the edge functions
//   apple/Config/Backend.xcconfig       TOKENY_SUPABASE_HOST / TOKENY_SUPABASE_ANON_KEY
//   apple/.../AppConfig.swift           built-in fallback used by tests / bundles without keys
// Both values are public (they ship in the web bundle). Never pass the service_role key.
// src/test/backend-config.test.ts fails if these files ever disagree.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [ref, key] = process.argv.slice(2);
if (!ref || !/^[a-z0-9]{20}$/.test(ref) || !key) {
  console.error("usage: node scripts/set-backend.mjs <20-char project ref> <publishable key>");
  process.exit(1);
}
if (/service_role|^sb_secret_/.test(key) || (key.startsWith("eyJ") && JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role === "service_role")) {
  console.error("refusing: that is a secret (service_role) key; use the publishable/anon key");
  process.exit(1);
}
const host = `${ref}.supabase.co`;

function edit(rel, fn) {
  const file = path.join(root, rel);
  const before = readFileSync(file, "utf8");
  const after = fn(before);
  if (after === before) console.log(`unchanged  ${rel}`);
  else {
    writeFileSync(file, after);
    console.log(`updated    ${rel}`);
  }
}
const setLine = (s, name, value) =>
  new RegExp(`^${name}=.*$`, "m").test(s) ? s.replace(new RegExp(`^${name}=.*$`, "m"), `${name}=${value}`) : `${s.trimEnd()}\n${name}=${value}\n`;

edit(".env", (s) => {
  s = setLine(s, "VITE_SUPABASE_PROJECT_ID", `"${ref}"`);
  s = setLine(s, "VITE_SUPABASE_PUBLISHABLE_KEY", `"${key}"`);
  return setLine(s, "VITE_SUPABASE_URL", `"https://${host}"`);
});
edit("supabase/config.toml", (s) => s.replace(/^project_id = ".*"$/m, `project_id = "${ref}"`));
edit("vercel.json", (s) => s.replace(/https:\/\/[a-z0-9]{20}\.supabase\.co\/functions\/v1\//g, `https://${host}/functions/v1/`));
edit("apple/Config/Backend.xcconfig", (s) =>
  s.replace(/^TOKENY_SUPABASE_HOST = .*$/m, `TOKENY_SUPABASE_HOST = ${host}`).replace(/^TOKENY_SUPABASE_ANON_KEY = .*$/m, `TOKENY_SUPABASE_ANON_KEY = ${key}`),
);
edit("apple/TokenyKit/Sources/TokenyCore/AppConfig.swift", (s) =>
  s
    .replace(/(fallbackSupabaseHost = ")[^"]*(")/, `$1${host}$2`)
    .replace(/(fallbackAnonKey =\s*")[^"]*(")/, `$1${key}$2`),
);
console.log(`\nBackend is now https://${host}. Run: bun run test && bun run build`);
