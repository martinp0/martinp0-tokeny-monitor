// Every query that touches user data lives here and takes the caller's user id explicitly.
// Rule: no function in this file reads or writes another user's rows unless its name says so
// (`…ForCron`, `…ByShareToken`, `…ByCustomer`, `userIdByMcpToken`). Tenant isolation is
// tested against a real Postgres (PGlite) in src/test/server-isolation.test.ts.
import { createHash, randomBytes } from "node:crypto";
import { BUDGET_TZ, localDay } from "./lib/forecast.js";
import type { Db } from "./db.js";
import { freeHistoryFloor, isProSubscription, syncableCredentialIds } from "./lib/plan.js";
import { decryptSecret, encryptSecret, EncryptionKeyError } from "./crypto.js";
import { maskKey, MissingKeyError } from "./lib/credential-keys.js";

// ---------------------------------------------------------------- plan

export interface SubscriptionRowDb {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  price_id: string | null;
  status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export async function getSubscription(db: Db, userId: string): Promise<SubscriptionRowDb | null> {
  const { rows } = await db.query<SubscriptionRowDb>(
    `select stripe_customer_id, stripe_subscription_id, price_id, status,
            to_char(current_period_end at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as current_period_end,
            cancel_at_period_end
       from subscriptions where user_id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function isPro(db: Db, userId: string): Promise<boolean> {
  return isProSubscription(await getSubscription(db, userId));
}

/** null for Pro (whole history), else the first visible day (YYYY-MM-DD). */
export async function historyFloor(db: Db, userId: string): Promise<string | null> {
  return (await isPro(db, userId)) ? null : freeHistoryFloor();
}

// ---------------------------------------------------------------- profile

export interface Profile {
  display_name: string | null;
  avatar_url: string | null;
}

/** Returns the profile, creating it on first use (replaces the auth.users trigger). */
export async function ensureProfile(db: Db, userId: string, fallbackName: string | null): Promise<Profile> {
  const { rows } = await db.query<Profile>(
    `insert into profiles (user_id, display_name) values ($1, $2)
     on conflict (user_id) do update set user_id = excluded.user_id
     returning display_name, avatar_url`,
    [userId, fallbackName],
  );
  return rows[0];
}

export async function updateProfile(db: Db, userId: string, p: Partial<Profile>): Promise<Profile> {
  const { rows } = await db.query<Profile>(
    `insert into profiles (user_id, display_name, avatar_url) values ($1, $2, $3)
     on conflict (user_id) do update set
       display_name = coalesce($2, profiles.display_name),
       avatar_url = case when $4 then $3 else profiles.avatar_url end,
       updated_at = now()
     returning display_name, avatar_url`,
    [userId, p.display_name ?? null, p.avatar_url ?? null, p.avatar_url !== undefined],
  );
  return rows[0];
}

export async function displayName(db: Db, userId: string): Promise<string | null> {
  const { rows } = await db.query<{ display_name: string | null }>(
    "select display_name from profiles where user_id = $1",
    [userId],
  );
  return rows[0]?.display_name ?? null;
}

// ---------------------------------------------------------------- activity rows

export const ACTIVITY_COLUMNS = [
  "generation_id", "created_at", "cost_total", "cost_web_search", "cost_cache", "cost_file_processing",
  "byok_usage_inference", "tokens_prompt", "tokens_completion", "tokens_reasoning", "tokens_cached",
  "tokens_cache_write", "model_permaslug", "provider_name", "variant", "cancelled", "streamed", "user",
  "finish_reason_raw", "finish_reason_normalized", "generation_time_ms", "time_to_first_token_ms",
  "app_name", "api_key_name", "provider_source", "request_count", "billing_type",
] as const;
type ActivityColumn = (typeof ACTIVITY_COLUMNS)[number];

const NUMERIC_COLS = new Set<ActivityColumn>([
  "cost_total", "cost_web_search", "cost_cache", "cost_file_processing", "byok_usage_inference",
  "generation_time_ms", "time_to_first_token_ms",
]);
const INT_COLS = new Set<ActivityColumn>([
  "tokens_prompt", "tokens_completion", "tokens_reasoning", "tokens_cached", "tokens_cache_write", "request_count",
]);
const BOOL_COLS = new Set<ActivityColumn>(["cancelled", "streamed"]);
const PROVIDER_SOURCES = new Set(["openrouter", "anthropic", "openai", "gemini", "mistral", "groq", "xai", "cursor", "grok-bot"]);
const BILLING_TYPES = new Set(["included", "on_demand", "credits"]);

/** Normalise one incoming row; returns null when it can't be stored (missing id/date). */
export function sanitizeActivityRow(raw: Record<string, unknown>): Record<ActivityColumn, unknown> | null {
  const gid = typeof raw.generation_id === "string" ? raw.generation_id.trim().slice(0, 300) : "";
  const created = typeof raw.created_at === "string" ? raw.created_at.trim().slice(0, 40) : "";
  if (!gid || !created || Number.isNaN(Date.parse(created))) return null;
  const out = {} as Record<ActivityColumn, unknown>;
  for (const c of ACTIVITY_COLUMNS) {
    const v = raw[c];
    if (c === "generation_id") out[c] = gid;
    else if (c === "created_at") out[c] = created;
    else if (NUMERIC_COLS.has(c)) out[c] = Number.isFinite(Number(v)) ? Number(v) : 0;
    else if (INT_COLS.has(c)) {
      const n = Math.round(Number(v));
      out[c] = Number.isFinite(n) ? Math.max(c === "request_count" ? 1 : 0, Math.min(n, 2_000_000_000)) : c === "request_count" ? 1 : 0;
    } else if (BOOL_COLS.has(c)) out[c] = v === true || v === "true";
    else if (c === "provider_source") out[c] = typeof v === "string" && PROVIDER_SOURCES.has(v) ? v : "openrouter";
    else if (c === "billing_type") out[c] = typeof v === "string" && BILLING_TYPES.has(v) ? v : null;
    else out[c] = v == null ? "" : String(v).slice(0, 500);
  }
  return out;
}

/**
 * Insert rows for `userId` (always the caller; any user_id in the payload is ignored).
 * mode "upsert": overwrite rows with the same generation_id; "ignore": keep existing ones.
 * Returns how many rows were written (inserted or updated).
 */
export async function upsertActivity(
  db: Db,
  userId: string,
  rows: Record<string, unknown>[],
  mode: "upsert" | "ignore" = "upsert",
): Promise<number> {
  const clean = new Map<string, Record<ActivityColumn, unknown>>();
  for (const r of rows) {
    const s = sanitizeActivityRow(r);
    if (s) clean.set(s.generation_id as string, s); // last one wins (a batch can't touch a row twice)
  }
  if (clean.size === 0) return 0;
  const cols = ["user_id", ...ACTIVITY_COLUMNS];
  const params: unknown[] = [];
  const tuples: string[] = [];
  for (const r of clean.values()) {
    const base = params.length;
    params.push(userId, ...ACTIVITY_COLUMNS.map((c) => r[c]));
    tuples.push(`(${cols.map((_, i) => `$${base + i + 1}`).join(",")})`);
  }
  const quoted = cols.map((c) => `"${c}"`).join(",");
  const conflict = mode === "ignore"
    ? "do nothing"
    : `do update set ${ACTIVITY_COLUMNS.filter((c) => c !== "generation_id").map((c) => `"${c}" = excluded."${c}"`).join(", ")}`;
  const res = await db.query(
    `insert into activity_rows (${quoted}) values ${tuples.join(",")}
     on conflict (user_id, generation_id) ${conflict}`,
    params,
  );
  return res.rowCount ?? 0;
}

/** Upsert in batches of 500 (keeps the statement under Postgres' 65535 parameter limit). */
export async function upsertActivityBatched(db: Db, userId: string, rows: Record<string, unknown>[], mode: "upsert" | "ignore" = "upsert") {
  let written = 0;
  for (let i = 0; i < rows.length; i += 500) written += await upsertActivity(db, userId, rows.slice(i, i + 500), mode);
  return written;
}

export async function listActivity(
  db: Db,
  userId: string,
  opts: { offset: number; limit: number; from?: string | null },
): Promise<Record<string, unknown>[]> {
  const { rows } = await db.query(
    `select ${ACTIVITY_COLUMNS.map((c) => `"${c}"`).join(",")}
       from activity_rows
      where user_id = $1 and ($2::text is null or created_at >= $2)
      order by created_at desc, id asc
      offset $3 limit $4`,
    [userId, opts.from ?? null, opts.offset, opts.limit],
  );
  return rows;
}

export async function deleteActivity(db: Db, userId: string, generationId?: string): Promise<number> {
  const res = generationId
    ? await db.query("delete from activity_rows where user_id = $1 and generation_id = $2", [userId, generationId])
    : await db.query("delete from activity_rows where user_id = $1", [userId]);
  return res.rowCount ?? 0;
}

export interface AggRow {
  bucket: string;
  cost_total: number;
  request_count: number;
  row_count: number;
  tokens_prompt: number;
  tokens_completion: number;
  tokens_reasoning: number;
  tokens_cached: number;
  generation_time_ms_sum: number;
  timed_rows: number;
  first_at: string | null;
  last_at: string | null;
}

/** Port of public.activity_aggregate: SQL-side sums, always scoped to userId. */
export async function aggregateActivity(
  db: Db,
  userId: string,
  opts: { groupBy?: string; from?: string | null; to?: string | null; model?: string | null; provider?: string | null } = {},
): Promise<AggRow[]> {
  const bucket = {
    model: "a.model_permaslug",
    provider: "a.provider_name",
    source: "a.provider_source",
    day: "left(a.created_at, 10)",
    hour: "left(a.created_at, 13)",
  }[opts.groupBy ?? "none"] ?? "'all'";
  const { rows } = await db.query<AggRow>(
    `select ${bucket} as bucket,
            coalesce(sum(a.cost_total), 0)::float8 as cost_total,
            coalesce(sum(a.request_count), 0)::float8 as request_count,
            count(*)::float8 as row_count,
            coalesce(sum(a.tokens_prompt), 0)::float8 as tokens_prompt,
            coalesce(sum(a.tokens_completion), 0)::float8 as tokens_completion,
            coalesce(sum(a.tokens_reasoning), 0)::float8 as tokens_reasoning,
            coalesce(sum(a.tokens_cached), 0)::float8 as tokens_cached,
            coalesce(sum(a.generation_time_ms) filter (where a.generation_time_ms > 0), 0)::float8 as generation_time_ms_sum,
            (count(*) filter (where a.generation_time_ms > 0))::float8 as timed_rows,
            min(a.created_at) as first_at,
            max(a.created_at) as last_at
       from activity_rows a
      where a.user_id = $1
        and ($2::text is null or a.created_at >= $2)
        and ($3::text is null
             or (length($3) = 10 and a.created_at < (($3)::date + 1)::text)
             or (length($3) <> 10 and a.created_at <= $3))
        and ($4::text is null or a.model_permaslug = $4)
        and ($5::text is null or a.provider_name = $5 or a.provider_source = $5)
      group by 1`,
    [userId, opts.from ?? null, opts.to ?? null, opts.model ?? null, opts.provider ?? null],
  );
  return rows;
}

// ---------------------------------------------------------------- budget alerts

const BUDGET_COLS = `id, monthly_budget_usd::float8 as monthly_budget_usd, threshold_pct, enabled,
  coalesce(budget_amount, monthly_budget_usd)::float8 as budget_amount, budget_currency, thresholds, forecast_alert,
  provider_budgets, last_notified_at, created_at, updated_at`;

export interface BudgetRow {
  id: string;
  monthly_budget_usd: number;
  threshold_pct: number;
  enabled: boolean;
  budget_amount: number;
  budget_currency: "USD" | "CZK";
  thresholds: number[];
  forecast_alert: boolean;
  provider_budgets: Record<string, number>;
  last_notified_at: string | null;
  created_at: string;
  updated_at: string;
}

/** The caller's budget settings (notify_email is legacy and never returned). */
export async function getBudgetAlert(db: Db, userId: string): Promise<BudgetRow | null> {
  const { rows } = await db.query<BudgetRow>(`select ${BUDGET_COLS} from budget_alerts where user_id = $1`, [userId]);
  return rows[0] ?? null;
}

export async function saveBudgetAlert(
  db: Db,
  userId: string,
  a: {
    budget_amount: number; budget_currency: "USD" | "CZK"; thresholds: number[]; forecast_alert: boolean;
    provider_budgets: Record<string, number>; enabled: boolean; monthly_budget_usd: number;
  },
): Promise<BudgetRow> {
  const { rows } = await db.query<BudgetRow>(
    `insert into budget_alerts (user_id, monthly_budget_usd, threshold_pct, notify_email, enabled,
                                budget_amount, budget_currency, thresholds, forecast_alert, provider_budgets)
     values ($1, $2, $3, null, $4, $5, $6, $7::int[], $8, $9::jsonb)
     on conflict (user_id) do update set monthly_budget_usd = $2, threshold_pct = $3, notify_email = null,
       enabled = $4, budget_amount = $5, budget_currency = $6, thresholds = $7::int[], forecast_alert = $8,
       provider_budgets = $9::jsonb, updated_at = now()
     returning ${BUDGET_COLS}`,
    [userId, a.monthly_budget_usd, Math.min(...a.thresholds, 100), a.enabled, a.budget_amount, a.budget_currency,
      a.thresholds, a.forecast_alert, JSON.stringify(a.provider_budgets)],
  );
  return rows[0];
}

/** Cost per UTC day and provider_source since `from` (YYYY-MM-DD), plus first-ever usage day per source. */
/**
 * Cost per local day (default Europe/Prague) and provider since `from` (a UTC ISO prefix), plus each
 * provider's first local day. Rows are bucketed by UTC hour in SQL (created_at is UTC ISO text) and
 * mapped to local days here; Prague's offset is whole hours, so this is exact across DST.
 */
export async function dailyCostsBySource(db: Db, userId: string, from: string, tz: string = BUDGET_TZ) {
  const [{ rows: hours }, { rows: firstHours }] = await Promise.all([
    db.query<{ hour: string; source: string; cost: number }>(
      `select left(created_at, 13) as hour, provider_source as source, coalesce(sum(cost_total), 0)::float8 as cost
         from activity_rows where user_id = $1 and created_at >= $2 group by 1, 2`,
      [userId, from],
    ),
    db.query<{ source: string; first_hour: string }>(
      `select provider_source as source, left(min(created_at), 13) as first_hour
         from activity_rows where user_id = $1 group by 1`,
      [userId],
    ),
  ]);
  const acc = new Map<string, { day: string; source: string; cost: number }>();
  for (const h of hours) {
    const day = utcHourToLocalDay(h.hour, tz);
    if (!day) continue;
    const k = `${day}|${h.source}`;
    const e = acc.get(k);
    if (e) e.cost += Number(h.cost);
    else acc.set(k, { day, source: h.source, cost: Number(h.cost) });
  }
  const firsts = firstHours
    .map((f) => ({ source: f.source, first_day: utcHourToLocalDay(f.first_hour, tz) }))
    .filter((f): f is { source: string; first_day: string } => !!f.first_day);
  return { days: [...acc.values()], firsts };
}

/** "YYYY-MM-DDTHH" (UTC; "T" or " " separator) → local day; a bare "YYYY-MM-DD" is kept as is. */
export function utcHourToLocalDay(hour: string, tz: string = BUDGET_TZ): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}))?/.exec(hour ?? "");
  if (!m) return null;
  if (m[4] === undefined) return `${m[1]}-${m[2]}-${m[3]}`;
  return localDay(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4]), tz);
}

export interface BudgetEvent {
  id: string;
  period: string;
  kind: "threshold" | "forecast";
  scope: string;
  threshold_pct: number;
  spent_usd: number;
  budget_usd: number;
  forecast_usd: number | null;
  read_at: string | null;
  created_at: string;
}

/** Inserts alerts; the unique key dedupes per period. Returns how many were new. */
export async function insertBudgetEvents(
  db: Db,
  userId: string,
  period: string,
  events: Array<{ kind: string; scope: string; threshold_pct: number; spent_usd: number; budget_usd: number; forecast_usd: number | null }>,
): Promise<number> {
  let n = 0;
  for (const e of events) {
    const r = await db.query(
      `insert into budget_events (user_id, period, kind, scope, threshold_pct, spent_usd, budget_usd, forecast_usd)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict on constraint budget_events_dedupe_key do nothing returning id`,
      [userId, period, e.kind, e.scope, e.threshold_pct, e.spent_usd, e.budget_usd, e.forecast_usd],
    );
    n += r.rows.length;
  }
  return n;
}

export async function listBudgetEvents(db: Db, userId: string, limit = 50): Promise<{ alerts: BudgetEvent[]; unread: number }> {
  const [{ rows }, { rows: c }] = await Promise.all([
    db.query<BudgetEvent>(
      `select id, period, kind, scope, threshold_pct, spent_usd, budget_usd, forecast_usd, read_at, created_at
         from budget_events where user_id = $1 order by created_at desc, threshold_pct desc limit $2`,
      [userId, limit],
    ),
    db.query<{ n: number }>("select count(*)::int as n from budget_events where user_id = $1 and read_at is null", [userId]),
  ]);
  return { alerts: rows, unread: Number(c[0]?.n ?? 0) };
}

/** Marks the caller's alerts read (all when `ids` is null). Ids of other users are ignored. */
export async function markBudgetEventsRead(db: Db, userId: string, ids: string[] | null): Promise<number> {
  const r = ids
    ? await db.query("update budget_events set read_at = now() where user_id = $1 and read_at is null and id = any($2::uuid[]) returning id", [userId, ids])
    : await db.query("update budget_events set read_at = now() where user_id = $1 and read_at is null returning id", [userId]);
  return r.rows.length;
}

export async function deleteBudgetAlert(db: Db, userId: string) {
  await db.query("delete from budget_alerts where user_id = $1", [userId]);
}

// ---------------------------------------------------------------- personal (MCP / API) tokens

export const sha256Hex = (s: string) => createHash("sha256").update(s).digest("hex");

export async function listMcpTokens(db: Db, userId: string) {
  const { rows } = await db.query(
    "select id, name, last_used_at, created_at from mcp_tokens where user_id = $1 order by created_at desc",
    [userId],
  );
  return rows;
}

/** Creates a token; the plain value is returned once and only its sha256 is stored. */
export async function createMcpToken(db: Db, userId: string, name: string): Promise<{ id: string; token: string; name: string }> {
  const token = "orm_" + randomBytes(32).toString("hex");
  const { rows } = await db.query<{ id: string }>(
    "insert into mcp_tokens (user_id, token_hash, name) values ($1, $2, $3) returning id",
    [userId, sha256Hex(token), name],
  );
  return { id: rows[0].id, token, name };
}

export async function deleteMcpToken(db: Db, userId: string, id: string): Promise<boolean> {
  const res = await db.query("delete from mcp_tokens where id = $1 and user_id = $2", [id, userId]);
  return (res.rowCount ?? 0) > 0;
}

/** Resolve a presented orm_ token to its owner (cross-user lookup by design: it IS the auth step). */
export async function userIdByMcpToken(db: Db, token: string): Promise<string | null> {
  if (!/^orm_[0-9a-f]{64}$/.test(token)) return null;
  const { rows } = await db.query<{ user_id: string }>(
    "update mcp_tokens set last_used_at = now() where token_hash = $1 returning user_id",
    [sha256Hex(token)],
  );
  return rows[0]?.user_id ?? null;
}

// ---------------------------------------------------------------- shared dashboards

const SHARE_PUBLIC_COLS = `id, label, filters as scope, created_at, expires_at, revoked_at, view_count, last_viewed_at`;

/** The owner's links (never the token: only its hash is stored). Revoked ones are hidden. */
export async function listShares(db: Db, userId: string) {
  const { rows } = await db.query(
    `select ${SHARE_PUBLIC_COLS} from shared_dashboards
      where user_id = $1 and revoked_at is null order by created_at desc`,
    [userId],
  );
  return rows;
}

export async function createShare(db: Db, userId: string, s: { token_hash: string; label: string | null; scope: unknown; expires_at: string | null }) {
  const { rows } = await db.query(
    `insert into shared_dashboards (user_id, token_hash, label, filters, expires_at) values ($1, $2, $3, $4::jsonb, $5)
     returning ${SHARE_PUBLIC_COLS}`,
    [userId, s.token_hash, s.label, JSON.stringify(s.scope ?? {}), s.expires_at],
  );
  return rows[0];
}

export async function countActiveShares(db: Db, userId: string): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    "select count(*)::int as n from shared_dashboards where user_id = $1 and revoked_at is null and (expires_at is null or expires_at > now())",
    [userId],
  );
  return rows[0]?.n ?? 0;
}

/** Revoke one of the caller's links (kept so the public page can say 410 Gone). */
export async function revokeShare(db: Db, userId: string, id: string): Promise<boolean> {
  const res = await db.query(
    "update shared_dashboards set revoked_at = now(), share_token = null where id = $1 and user_id = $2 and revoked_at is null",
    [id, userId],
  );
  return (res.rowCount ?? 0) > 0;
}

/** Public read of one share by the SHA-256 of its token (the token is the capability). */
export async function shareByTokenHash(db: Db, tokenHash: string) {
  const { rows } = await db.query<{
    id: string; user_id: string; label: string | null; filters: unknown; created_at: string; expires_at: string | null; revoked_at: string | null;
  }>(
    "select id, user_id, label, filters, created_at, expires_at, revoked_at from shared_dashboards where token_hash = $1",
    [tokenHash],
  );
  return rows[0] ?? null;
}

export async function markShareViewed(db: Db, id: string) {
  await db.query("update shared_dashboards set view_count = view_count + 1, last_viewed_at = now() where id = $1", [id]);
}

// ---------------------------------------------------------------- rate limits (public endpoints)

/** Fixed window counter; returns the hits in the current window including this one. */
export async function hitRateLimit(db: Db, bucket: string, windowSec: number, now = new Date()): Promise<number> {
  const start = new Date(Math.floor(now.getTime() / (windowSec * 1000)) * windowSec * 1000).toISOString();
  const { rows } = await db.query<{ hits: number }>(
    `insert into rate_limits (bucket, window_start, hits) values ($1, $2, 1)
     on conflict (bucket, window_start) do update set hits = rate_limits.hits + 1 returning hits`,
    [bucket, start],
  );
  return rows[0]?.hits ?? 1;
}

export async function pruneRateLimits(db: Db): Promise<number> {
  const res = await db.query("delete from rate_limits where window_start < now() - interval '1 day'");
  return res.rowCount ?? 0;
}

// ---------------------------------------------------------------- provider credentials

const CRED_PUBLIC_COLS = `id, provider, label, key_preview, enabled, organization_id, last_synced_at,
  last_sync_attempt_at, last_sync_status, last_sync_error, rows_imported, created_at, updated_at`;

export async function listCredentials(db: Db, userId: string) {
  const { rows } = await db.query(
    `select ${CRED_PUBLIC_COLS} from provider_credentials where user_id = $1 order by created_at asc, id asc`,
    [userId],
  );
  return rows;
}

/** Create or rotate (user, provider, label). The key is encrypted before it reaches the DB. */
export async function saveCredential(
  db: Db,
  userId: string,
  c: { provider: string; label: string; apiKey: string; organizationId: string | null },
) {
  const ciphertext = encryptSecret(c.apiKey.trim(), userId);
  const { rows } = await db.query(
    `insert into provider_credentials (user_id, provider, label, api_key_ciphertext, key_preview, organization_id)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (user_id, provider, label) do update set api_key_ciphertext = excluded.api_key_ciphertext,
       key_preview = excluded.key_preview, organization_id = excluded.organization_id, enabled = true,
       last_sync_status = null, last_sync_error = null, updated_at = now()
     returning ${CRED_PUBLIC_COLS}`,
    [userId, c.provider, c.label, ciphertext, maskKey(c.apiKey), c.organizationId],
  );
  return rows[0];
}

export async function setCredentialEnabled(db: Db, userId: string, id: string, enabled: boolean): Promise<boolean> {
  const res = await db.query(
    "update provider_credentials set enabled = $3, updated_at = now() where id = $1 and user_id = $2",
    [id, userId, enabled],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function deleteCredential(db: Db, userId: string, id: string): Promise<boolean> {
  const res = await db.query("delete from provider_credentials where id = $1 and user_id = $2", [id, userId]);
  return (res.rowCount ?? 0) > 0;
}

export interface CredentialForSync {
  id: string;
  user_id: string;
  provider: string;
  enabled: boolean;
  last_synced_at: string | null;
  created_at: string;
  api_key_ciphertext: string;
}

export async function credentialForSync(db: Db, userId: string, id: string): Promise<CredentialForSync | null> {
  const { rows } = await db.query<CredentialForSync>(
    `select id, user_id, provider, enabled, last_synced_at, created_at::text as created_at, api_key_ciphertext
       from provider_credentials where id = $1 and user_id = $2`,
    [id, userId],
  );
  return rows[0] ?? null;
}

/** Free users may only sync their oldest credential. */
export async function canSyncCredential(db: Db, userId: string, id: string, pro: boolean): Promise<boolean> {
  if (pro) return true;
  const { rows } = await db.query<{ id: string; created_at: string }>(
    "select id, created_at::text as created_at from provider_credentials where user_id = $1",
    [userId],
  );
  return syncableCredentialIds(rows, false).has(id);
}

export function decryptCredential(c: CredentialForSync): string {
  try {
    return decryptSecret(c.api_key_ciphertext, c.user_id);
  } catch (e) {
    if (e instanceof EncryptionKeyError) throw e;
    throw new MissingKeyError();
  }
}

export async function markCredentialSync(
  db: Db,
  credentialId: string,
  userId: string,
  patch: { status: "running" | "ok" | "error"; error?: string | null; rowsImported?: number },
) {
  if (patch.status === "running") {
    await db.query(
      `update provider_credentials set last_sync_status = 'running', last_sync_error = null,
         last_sync_attempt_at = now() where id = $1 and user_id = $2`,
      [credentialId, userId],
    );
  } else if (patch.status === "ok" || patch.rowsImported !== undefined) {
    await db.query(
      `update provider_credentials set last_sync_status = $3, last_sync_error = $4, last_synced_at = now(),
         rows_imported = coalesce($5, rows_imported) where id = $1 and user_id = $2`,
      [credentialId, userId, patch.status, patch.error ?? null, patch.rowsImported ?? null],
    );
  } else {
    await db.query(
      "update provider_credentials set last_sync_status = 'error', last_sync_error = $3 where id = $1 and user_id = $2",
      [credentialId, userId, (patch.error ?? "").slice(0, 500)],
    );
  }
}

/** Cron only: enabled credentials of Pro users that are due, oldest attempt first. */
export async function dueCredentialsForCron(db: Db, dueBefore: Date, limit: number): Promise<CredentialForSync[]> {
  const { rows } = await db.query<CredentialForSync>(
    `select c.id, c.user_id, c.provider, c.enabled, c.last_synced_at, c.created_at::text as created_at, c.api_key_ciphertext
       from provider_credentials c
      where c.enabled and c.provider in ('openrouter', 'anthropic', 'openai')
        and (c.last_sync_attempt_at is null or c.last_sync_attempt_at < $1)
        and public.is_pro(c.user_id)
      order by c.last_sync_attempt_at asc nulls first
      limit $2`,
    [dueBefore.toISOString(), Math.max(1, Math.min(limit, 500))],
  );
  return rows;
}

// ---------------------------------------------------------------- exchange rate (public data)

export async function getExchangeRate(db: Db): Promise<{ rate: number; source_date: string | null; fetched_at: string } | null> {
  const { rows } = await db.query<{ rate: number; source_date: string | null; fetched_at: string }>(
    "select rate::float8 as rate, source_date, fetched_at from exchange_rates where currency_pair = 'USD_CZK'",
  );
  return rows[0] ?? null;
}

export async function saveExchangeRate(db: Db, rate: number, sourceDate: string | null) {
  await db.query(
    `insert into exchange_rates (currency_pair, rate, source_date, fetched_at) values ('USD_CZK', $1, $2, now())
     on conflict (currency_pair) do update set rate = $1, source_date = $2, fetched_at = now()`,
    [rate, sourceDate],
  );
}

// ---------------------------------------------------------------- Stripe (webhook = trusted server input)

export async function userIdByCustomer(db: Db, customerId: string): Promise<string | null> {
  const { rows } = await db.query<{ user_id: string }>(
    "select user_id from subscriptions where stripe_customer_id = $1 limit 1",
    [customerId],
  );
  return rows[0]?.user_id ?? null;
}

export async function upsertSubscription(db: Db, row: {
  user_id: string; stripe_customer_id: string | null; stripe_subscription_id: string; price_id: string | null;
  status: string; current_period_start: string | null; current_period_end: string | null; cancel_at_period_end: boolean;
}) {
  await db.query(
    `insert into subscriptions (user_id, stripe_customer_id, stripe_subscription_id, price_id, status,
        current_period_start, current_period_end, cancel_at_period_end, updated_at)
     values ($1, coalesce($2, ''), $3, $4, $5, $6, $7, $8, now())
     on conflict (user_id) do update set stripe_customer_id = coalesce($2, subscriptions.stripe_customer_id),
       stripe_subscription_id = $3, price_id = $4, status = $5, current_period_start = $6,
       current_period_end = $7, cancel_at_period_end = $8, updated_at = now()`,
    [row.user_id, row.stripe_customer_id, row.stripe_subscription_id, row.price_id, row.status,
      row.current_period_start, row.current_period_end, row.cancel_at_period_end],
  );
}

export async function userExists(db: Db, userId: string): Promise<boolean> {
  const { rows } = await db.query('select 1 from neon_auth."user" where id = $1', [userId]);
  return rows.length > 0;
}

/** Deletes the Neon Auth user; every table above cascades (FK … ON DELETE CASCADE). */
export async function deleteUserCascade(db: Db, userId: string): Promise<void> {
  await db.query('delete from neon_auth."user" where id = $1', [userId]);
}

// ---------------------------------------------------------------- budget check (cron)

export async function budgetAlertsForCron(db: Db, onlyUserId: string | null = null) {
  const { rows } = await db.query<BudgetRow & { user_id: string }>(
    `select user_id, ${BUDGET_COLS} from budget_alerts
      where enabled and public.is_pro(user_id) and ($1::uuid is null or user_id = $1)`,
    [onlyUserId],
  );
  return rows;
}

export async function markBudgetNotified(db: Db, userId: string) {
  await db.query("update budget_alerts set last_notified_at = now() where user_id = $1", [userId]);
}

// ------------------------------------------------------------------ the user's own AI key (BYOK)
const AI_KEY_PUBLIC_COLS = "provider, key_preview, last_used_at, created_at, updated_at";

export interface AiKeyInfo {
  provider: string;
  key_preview: string;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Public metadata only: never the ciphertext, never the key. */
export async function listAiKeys(db: Db, userId: string): Promise<AiKeyInfo[]> {
  const { rows } = await db.query<AiKeyInfo>(`select ${AI_KEY_PUBLIC_COLS} from ai_keys where user_id = $1 order by created_at`, [userId]);
  return rows;
}

export async function getAiKeyInfo(db: Db, userId: string, provider = "anthropic"): Promise<AiKeyInfo | null> {
  const { rows } = await db.query<AiKeyInfo>(
    `select ${AI_KEY_PUBLIC_COLS} from ai_keys where user_id = $1 and provider = $2`,
    [userId, provider],
  );
  return rows[0] ?? null;
}

export async function saveAiKey(db: Db, userId: string, provider: string, apiKey: string): Promise<AiKeyInfo> {
  const key = apiKey.trim();
  const { rows } = await db.query<AiKeyInfo>(
    `insert into ai_keys (user_id, provider, api_key_ciphertext, key_preview) values ($1, $2, $3, $4)
     on conflict (user_id, provider) do update set api_key_ciphertext = excluded.api_key_ciphertext,
       key_preview = excluded.key_preview, last_used_at = null, updated_at = now()
     returning ${AI_KEY_PUBLIC_COLS}`,
    [userId, provider, encryptSecret(key, userId), maskKey(key)],
  );
  return rows[0];
}

export async function deleteAiKey(db: Db, userId: string, provider = "anthropic"): Promise<boolean> {
  const res = await db.query("delete from ai_keys where user_id = $1 and provider = $2", [userId, provider]);
  return (res.rowCount ?? 0) > 0;
}

/**
 * Decrypted key of the caller, for a server-side provider call only. Returns "undecryptable" when
 * the stored ciphertext no longer opens (e.g. rotated server key) so the caller can ask for a new key.
 */
export async function aiKeyForUser(db: Db, userId: string, provider = "anthropic"): Promise<string | null | "undecryptable"> {
  const { rows } = await db.query<{ api_key_ciphertext: string }>(
    "select api_key_ciphertext from ai_keys where user_id = $1 and provider = $2",
    [userId, provider],
  );
  if (!rows[0]) return null;
  try {
    return decryptSecret(rows[0].api_key_ciphertext, userId);
  } catch (e) {
    if (e instanceof EncryptionKeyError) throw e;
    return "undecryptable";
  }
}

export async function markAiKeyUsed(db: Db, userId: string, provider = "anthropic"): Promise<void> {
  await db.query("update ai_keys set last_used_at = now() where user_id = $1 and provider = $2", [userId, provider]);
}

export interface AiSettings { provider: string; model: string }

export async function getAiSettings(db: Db, userId: string): Promise<AiSettings | null> {
  const { rows } = await db.query<AiSettings>("select provider, model from ai_settings where user_id = $1", [userId]);
  return rows[0] ?? null;
}

export async function saveAiSettings(db: Db, userId: string, provider: string, model: string): Promise<AiSettings> {
  const { rows } = await db.query<AiSettings>(
    `insert into ai_settings (user_id, provider, model) values ($1, $2, $3)
     on conflict (user_id) do update set provider = excluded.provider, model = excluded.model, updated_at = now()
     returning provider, model`,
    [userId, provider, model],
  );
  return rows[0];
}

/** Forget the provider choice when it points at a key the user just removed. */
export async function clearAiSettingsFor(db: Db, userId: string, provider: string): Promise<void> {
  await db.query("delete from ai_settings where user_id = $1 and provider = $2", [userId, provider]);
}
