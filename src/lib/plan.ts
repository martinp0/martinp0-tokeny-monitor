// Plan rules shared with the edge functions (single implementation in supabase/functions/_shared).
export {
  FREE_LIMITS,
  PRO_REQUIRED_ERROR,
  freeHistoryFloor,
  isProSubscription,
  type ProFeature,
} from "../../supabase/functions/_shared/plan.ts";

import { freeHistoryFloor } from "../../supabase/functions/_shared/plan.ts";

/**
 * Free plan CSV import: rows older than the free window are dropped before upload. RLS hides them
 * from free users, and PostgREST upserts (ON CONFLICT with a target) are checked against the
 * SELECT policy, so they would fail anyway.
 */
export function splitRowsForPlan<T extends { created_at: string }>(
  rows: T[],
  isPro: boolean,
  now: Date = new Date(),
): { keep: T[]; skipped: number } {
  if (isPro) return { keep: rows, skipped: 0 };
  const floor = freeHistoryFloor(now);
  const keep = rows.filter((r) => String(r.created_at).slice(0, 10) >= floor);
  return { keep, skipped: rows.length - keep.length };
}

/** Parsed `{ error: "pro_required", feature }` body from a supabase.functions.invoke error, if any. */
export async function proRequiredFeature(error: unknown): Promise<string | null> {
  const ctx = (error as { context?: unknown } | null)?.context;
  if (!ctx || typeof (ctx as Response).clone !== "function") return null;
  try {
    const body = await (ctx as Response).clone().json();
    return body?.error === "pro_required" ? String(body.feature ?? "") : null;
  } catch {
    return null;
  }
}
