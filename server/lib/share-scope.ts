/**
 * Shared dashboard links: token format, hashing and the validated scope. PURE (node:crypto only).
 * The token (256 random bits, base64url) is shown to the owner once; only its SHA-256 is stored.
 */
import { createHash, randomBytes } from "node:crypto";
import { BUDGET_PROVIDERS } from "./budget.js";
import { addDays, localDay } from "./forecast.js";

export const SHARE_ROLLING_DAYS = [7, 30, 90, 365] as const;
export const MAX_RANGE_DAYS = 731;
export const MAX_EXPIRY_DAYS = 366;
/** New tokens are 43 base64url chars; legacy (v1) ones were 32 hex chars. */
export const SHARE_TOKEN_RE = /^[A-Za-z0-9_-]{32,64}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export type SharePeriod =
  | { type: "rolling"; days: (typeof SHARE_ROLLING_DAYS)[number] }
  | { type: "month" }
  | { type: "range"; from: string; to: string };

export interface ShareScope {
  period: SharePeriod;
  /** Empty = all providers. */
  providers: string[];
  /** false = only percentages, tokens and requests (no money amounts at all in the payload). */
  show_amounts: boolean;
  currency: "USD" | "CZK";
}

export const newShareToken = () => randomBytes(32).toString("base64url");
export const hashShareToken = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");

export function validDay(s: unknown): s is string {
  if (typeof s !== "string" || !DAY_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;

/** Concrete inclusive local-day range for a period at `now` (Europe/Prague days). */
export function resolvePeriod(p: SharePeriod, now = new Date()): { from: string; to: string } {
  const today = localDay(now);
  if (p.type === "range") return { from: p.from, to: p.to };
  if (p.type === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  return { from: addDays(today, -(p.days - 1)), to: today };
}

export type ParsedShare =
  | { ok: true; value: { label: string | null; scope: ShareScope; expires_at: string | null } }
  | { ok: false; error: string };

/** Drops ASCII control characters (labels are shown on a public page). */
const stripControl = (s: string) => [...s].filter((ch) => { const c = ch.charCodeAt(0); return c > 0x1f && c !== 0x7f; }).join("");

export function parseShareInput(b: any, now = new Date()): ParsedShare {
  if (!b || typeof b !== "object") return { ok: false, error: "invalid_body" };
  const label = typeof b.label === "string" ? stripControl(b.label).trim().slice(0, 80) || null : null;

  const p = b.period ?? { type: "rolling", days: 30 };
  let period: SharePeriod;
  if (p?.type === "rolling" && SHARE_ROLLING_DAYS.includes(p.days)) period = { type: "rolling", days: p.days };
  else if (p?.type === "month") period = { type: "month" };
  else if (p?.type === "range" && validDay(p.from) && validDay(p.to) && p.from <= p.to) {
    if (daysBetween(p.from, p.to) > MAX_RANGE_DAYS) return { ok: false, error: "range_too_long" };
    period = { type: "range", from: p.from, to: p.to };
  } else return { ok: false, error: "invalid_period" };

  const raw = b.providers ?? [];
  if (!Array.isArray(raw) || raw.length > BUDGET_PROVIDERS.length) return { ok: false, error: "invalid_providers" };
  const providers = [...new Set(raw)].filter((x): x is string => typeof x === "string");
  if (providers.length !== raw.length || providers.some((x) => !(BUDGET_PROVIDERS as readonly string[]).includes(x))) {
    return { ok: false, error: "invalid_providers" };
  }
  providers.sort();

  const show_amounts = b.show_amounts === undefined ? true : b.show_amounts === true;
  if (b.show_amounts !== undefined && typeof b.show_amounts !== "boolean") return { ok: false, error: "invalid_show_amounts" };
  const currency = b.currency === "CZK" ? "CZK" : b.currency === undefined || b.currency === "USD" ? "USD" : null;
  if (!currency) return { ok: false, error: "invalid_currency" };

  let expires_at: string | null = null;
  if (b.expires_at !== undefined && b.expires_at !== null && b.expires_at !== "") {
    const d = new Date(b.expires_at);
    if (typeof b.expires_at !== "string" || Number.isNaN(d.getTime())) return { ok: false, error: "invalid_expires_at" };
    if (d.getTime() <= now.getTime()) return { ok: false, error: "expires_in_past" };
    if (d.getTime() > now.getTime() + MAX_EXPIRY_DAYS * 86_400_000) return { ok: false, error: "expires_too_far" };
    expires_at = d.toISOString();
  }
  return { ok: true, value: { label, scope: { period, providers, show_amounts, currency }, expires_at } };
}

/** Old rows (v1) have no scope: show the last 30 days, all providers, with amounts. */
export function scopeFromStored(filters: any): ShareScope {
  const r = parseShareInput({ ...(filters && typeof filters === "object" ? filters : {}), label: null, expires_at: null });
  return r.ok ? r.value.scope : { period: { type: "rolling", days: 30 }, providers: [], show_amounts: true, currency: "USD" };
}
