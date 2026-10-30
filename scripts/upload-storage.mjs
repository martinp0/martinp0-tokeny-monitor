#!/usr/bin/env node
// Uploads a local copy of the og-images bucket (downloaded from Lovable Cloud → Storage) into the
// new project, keeping each file's path (<user id>/<file>) so shared_dashboards.og_image_path
// keeps working.
//
//   SUPABASE_URL=https://<new-ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/upload-storage.mjs ./og-images-download [bucket=og-images]
//
// The service-role key is read from the environment only; never write it to .env or the repo.
import { readdir, readFile } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import { createClient } from "@supabase/supabase-js";

const [dir, bucket = "og-images"] = process.argv.slice(2);
const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
if (!dir || !url || !key) {
  console.error("usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/upload-storage.mjs <dir> [bucket]");
  process.exit(1);
}
if (url.includes("cfjusewixhycahgxoylm")) {
  console.error("refusing: that is the Lovable Cloud project");
  process.exit(1);
}
const types = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml" };
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function* walk(d) {
  for (const e of await readdir(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile() && !e.name.startsWith(".")) yield p;
  }
}

let ok = 0, failed = 0;
for await (const file of walk(dir)) {
  const path = relative(dir, file).split("\\").join("/");
  const { error } = await supabase.storage.from(bucket).upload(path, await readFile(file), {
    upsert: true,
    contentType: types[extname(file).toLowerCase()] ?? "application/octet-stream",
  });
  if (error) { failed++; console.error(`✗ ${path}: ${error.message}`); } else { ok++; console.log(`✓ ${path}`); }
}
console.log(`${ok} uploaded, ${failed} failed`);
process.exit(failed ? 1 : 0);
