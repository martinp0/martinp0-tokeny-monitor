// Account deletion, including ending the Stripe subscription. Pure (no Deno/URL imports) so
// Vitest can test it (src/test/account-deletion.test.ts); delete-account/index.ts wires it up.
//
// Order matters: billing is ended FIRST. If Stripe fails (other than "already gone"), nothing is
// deleted and the caller gets an error, so we never delete an account that keeps being charged.
// Every step is idempotent, so the user (or the app) can simply retry.

/** Stripe statuses that can still charge or become active again. */
export const CANCELLABLE_STATUSES = ["active", "trialing", "past_due", "unpaid", "incomplete", "paused"] as const;

export interface StripeSubLite {
  id: string;
  status: string;
}

export interface BillingDeps {
  /** All subscriptions of the customer, any status. */
  listSubscriptions(customerId: string): Promise<StripeSubLite[]>;
  /** Cancel immediately, no proration credit, no final invoice. */
  cancelSubscription(subscriptionId: string): Promise<void>;
  /** Drop our user id from the customer metadata (the customer itself stays for invoices). */
  markCustomerDeleted(customerId: string): Promise<void>;
}

export interface BillingOutcome {
  customerId: string | null;
  canceled: string[];
  alreadyEnded: string[];
  customerMissing: boolean;
}

/** Stripe "No such customer/subscription" and "already canceled" errors: the goal is met. */
export function isStripeGone(e: unknown): boolean {
  const err = e as { code?: string; raw?: { code?: string }; statusCode?: number; message?: string } | null;
  const code = err?.code ?? err?.raw?.code;
  if (code === "resource_missing") return true;
  const msg = (err?.message ?? "").toLowerCase();
  return /no such (customer|subscription)/.test(msg) || /(already|has been)( been)? cancel/.test(msg);
}

export async function endBilling(customerId: string | null, deps: BillingDeps): Promise<BillingOutcome> {
  const out: BillingOutcome = { customerId, canceled: [], alreadyEnded: [], customerMissing: false };
  if (!customerId) return out;

  let subs: StripeSubLite[];
  try {
    subs = await deps.listSubscriptions(customerId);
  } catch (e) {
    if (isStripeGone(e)) {
      out.customerMissing = true;
      return out;
    }
    throw e;
  }

  for (const s of subs) {
    if (!(CANCELLABLE_STATUSES as readonly string[]).includes(s.status)) {
      out.alreadyEnded.push(s.id);
      continue;
    }
    try {
      await deps.cancelSubscription(s.id);
      out.canceled.push(s.id);
    } catch (e) {
      if (!isStripeGone(e)) throw e;
      out.alreadyEnded.push(s.id);
    }
  }

  try {
    await deps.markCustomerDeleted(customerId);
  } catch (e) {
    if (!isStripeGone(e)) throw e;
    out.customerMissing = true;
  }
  return out;
}

/** Tables with per-user rows, deleted before the auth user (most also cascade from auth.users). */
export const USER_TABLES = [
  "activity_rows",
  "budget_alerts",
  "mcp_tokens",
  "shared_dashboards",
  "provider_credentials",
  "ai_settings",
  "ai_keys",
  "subscriptions",
  "profiles",
] as const;

export interface DeletionDeps {
  /** Stripe customer of the user from public.subscriptions, if any. */
  customerIdFor(userId: string): Promise<string | null>;
  /** null when STRIPE_SECRET_KEY isn't configured. */
  billing: BillingDeps | null;
  deleteRows(table: (typeof USER_TABLES)[number], userId: string): Promise<void>;
  deleteAuthUser(userId: string): Promise<void>;
  log?(msg: string, extra?: Record<string, unknown>): void;
}

export type DeletionResult =
  | { ok: true; billing: BillingOutcome }
  | { ok: false; error: "billing_unavailable" | "billing_failed" | "delete_failed" };

export async function deleteAccount(userId: string, deps: DeletionDeps): Promise<DeletionResult> {
  const customerId = await deps.customerIdFor(userId);

  let billing: BillingOutcome = { customerId: null, canceled: [], alreadyEnded: [], customerMissing: false };
  if (customerId) {
    if (!deps.billing) {
      deps.log?.("delete-account: user has a Stripe customer but Stripe is not configured", { userId });
      return { ok: false, error: "billing_unavailable" };
    }
    try {
      billing = await endBilling(customerId, deps.billing);
    } catch (e) {
      deps.log?.("delete-account: ending the Stripe subscription failed", { userId, error: e instanceof Error ? e.message : String(e) });
      return { ok: false, error: "billing_failed" };
    }
  }

  try {
    for (const t of USER_TABLES) await deps.deleteRows(t, userId);
    await deps.deleteAuthUser(userId);
  } catch (e) {
    deps.log?.("delete-account: deleting data failed", { userId, error: e instanceof Error ? e.message : String(e) });
    return { ok: false, error: "delete_failed" };
  }
  deps.log?.("delete-account: done", { userId, canceled: billing.canceled.length, customerMissing: billing.customerMissing });
  return { ok: true, billing };
}
