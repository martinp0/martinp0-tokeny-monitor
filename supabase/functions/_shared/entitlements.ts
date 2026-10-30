// Server-side plan lookups for edge functions (service-role client; RLS does not apply there,
// so every function that serves user data must check the plan itself).
import { isProSubscription, proRequiredBody, type ProFeature } from "./plan.ts";
import { json } from "./http.ts";

// Structural type so callers can pass a client from any supabase-js version/import (esm.sh or npm).
type SubscriptionLookup = PromiseLike<{
  data: { status: string | null; current_period_end: string | null } | null;
  error: { message: string } | null;
}>;
type Db = {
  // deno-lint-ignore no-explicit-any
  from(table: string): any;
};

export async function getIsPro(svc: Db, userId: string): Promise<boolean> {
  const { data, error } = await (svc
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle() as SubscriptionLookup);
  if (error) {
    // Fail closed for paid features, but loudly.
    console.error("entitlements: subscription lookup failed", error.message);
    return false;
  }
  return isProSubscription(data);
}

/** 403 response for a Pro-only feature. */
export function proRequired(feature: ProFeature): Response {
  return json(proRequiredBody(feature), 403);
}
