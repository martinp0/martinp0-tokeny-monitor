// Plan rules shared with the API (single implementation in server/lib/plan.ts).
export {
  FREE_LIMITS,
  PRO_REQUIRED_ERROR,
  freeHistoryFloor,
  isProSubscription,
  type ProFeature,
} from "../../server/lib/plan";

import { freeHistoryFloor } from "../../server/lib/plan";

/**
 * Free plan CSV import: rows older than the free window are dropped before upload (the API hides
 * them from free users anyway, so uploading them would only look like a silent loss).
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

/** `feature` of a `{ error: "pro_required", feature }` API error (see src/lib/api.ts), if any. */
export async function proRequiredFeature(error: unknown): Promise<string | null> {
  const body = (error as { status?: number; body?: Record<string, unknown> | null } | null)?.body;
  return body?.error === "pro_required" ? String(body.feature ?? "") : null;
}
