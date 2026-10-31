// Postgres access for the API. One small pool per function instance (Vercel Fluid compute reuses
// instances), against the *pooled* Neon connection string in DATABASE_URL (never logged).
import pg from "pg";

export interface QueryResult<T> {
  rows: T[];
  rowCount: number | null;
}

/** The only DB surface the server uses, so tests can run the same code against PGlite. */
export interface Db {
  query<T = Record<string, any>>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
}

// bigint (count(*), tokens_cache_write) as JS numbers: our values stay far below 2^53.
pg.types.setTypeParser(20, (v: string) => Number(v));
// `date` columns stay plain YYYY-MM-DD strings (no local-time Date shift).
pg.types.setTypeParser(1082, (v: string) => v);

let pool: pg.Pool | null = null;

export function getDb(): Db {
  if (pool) return pool as unknown as Db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  // pg treats sslmode=require as verify-full already; drop the param to silence its warning.
  const connectionString = url.replace(/([?&])sslmode=require&?/, "$1").replace(/[?&]$/, "");
  pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: true }, max: 4, idleTimeoutMillis: 10_000 });
  pool.on("error", (e) => console.error("pg pool error", e.message));
  return pool as unknown as Db;
}
