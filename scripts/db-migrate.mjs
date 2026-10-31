#!/usr/bin/env node
// Apply db/schema.sql (idempotent) to the database in $DATABASE_URL. Never prints the URL.
//   DATABASE_URL=… node scripts/db-migrate.mjs
import { readFile } from "node:fs/promises";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const sql = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  const { rows } = await client.query(
    "select table_name from information_schema.tables where table_schema='public' order by 1",
  );
  console.log("schema applied; public tables:", rows.map((r) => r.table_name).join(", "));
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("migration failed:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
