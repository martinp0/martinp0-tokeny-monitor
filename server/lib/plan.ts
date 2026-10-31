/**
 * Plan / entitlement rules — PURE (no Deno, no URL imports) so Vitest can import it.
 * The SQL twin is `public.is_pro(uuid)` in migration 20261030130000_pro_entitlements.sql;
 * keep both in sync.
 */

/** Stripe subscription statuses that grant Pro (while the paid/trial period has not ended). */
export const PRO_STATUSES = ["active", "trialing", "past_due"] as const;

/** Free tier limits. */
export const FREE_LIMITS = {
  /** Max connected provider credentials (API sync). CSV import is unlimited. */
  providers: 1,
  /** Days of history visible (dashboard, RPC, API). Older rows are kept, just hidden until upgrade. */
  historyDays: 30,
} as const;

export type ProFeature =
  | "multi_provider"
  | "full_history"
  | "auto_sync"
  | "budget_alerts"
  | "exports"
  | "mcp"
  | "ai_agent"
  | "sharing"
  | "forecast";

export interface SubscriptionLike {
  status: string | null;
  current_period_end: string | null;
}

/** True when a `subscriptions` row grants Pro at `now`. */
export function isProSubscription(sub: SubscriptionLike | null | undefined, now: Date = new Date()): boolean {
  if (!sub || !sub.status) return false;
  if (!(PRO_STATUSES as readonly string[]).includes(sub.status)) return false;
  // NULL period end = Stripe did not send one yet (e.g. newer API shape not parsed) → trust status.
  if (!sub.current_period_end) return true;
  const end = Date.parse(sub.current_period_end);
  return Number.isNaN(end) ? true : end > now.getTime();
}

/** First day (YYYY-MM-DD, UTC) a free user may see. Matches the SQL `free_history_floor()`. */
export function freeHistoryFloor(now: Date = new Date()): string {
  const d = new Date(now.getTime() - FREE_LIMITS.historyDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** Clamp a requested `from` date to the free window (returns YYYY-MM-DD or the original). */
export function clampFromForPlan(from: string | null | undefined, isPro: boolean, now: Date = new Date()): string | null {
  if (isPro) return from ?? null;
  const floor = freeHistoryFloor(now);
  if (!from) return floor;
  return from.slice(0, 10) < floor ? floor : from;
}

/**
 * Whether a user may add one more provider credential.
 * `existingIds` = ids of the user's current credentials; `replacingId` = id being updated (if any).
 */
export function canAddProvider(isPro: boolean, existingIds: string[], replacingId?: string | null): boolean {
  if (isPro) return true;
  if (replacingId && existingIds.includes(replacingId)) return true;
  return existingIds.length < FREE_LIMITS.providers;
}

/**
 * For a free user, only the oldest `FREE_LIMITS.providers` credentials may sync (after a downgrade
 * the others stay stored but inactive). Input must contain `id` and `created_at`.
 */
export function syncableCredentialIds<T extends { id: string; created_at: string }>(creds: T[], isPro: boolean): Set<string> {
  if (isPro) return new Set(creds.map((c) => c.id));
  const sorted = [...creds].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  return new Set(sorted.slice(0, FREE_LIMITS.providers).map((c) => c.id));
}

export const PRO_REQUIRED_ERROR = "pro_required";

export function proRequiredBody(feature: ProFeature) {
  return { error: PRO_REQUIRED_ERROR, feature, message: "Tato funkce vyžaduje Tokeny Pro." };
}
