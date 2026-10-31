/**
 * Stripe billing logic — PURE (no Stripe SDK, no Deno) so Vitest can test it.
 *
 * Works with both the pre-2025 and the newer ("basil", 2025-03-31+) Stripe API shapes:
 *  - subscription `current_period_start/end` moved from the subscription onto each subscription item
 *  - invoice `subscription` moved to `invoice.parent.subscription_details.subscription`
 *    (and line items carry `parent.subscription_item_details.subscription`)
 */

import { isProSubscription } from "./plan.js";

// ---------- minimal structural types (subset of Stripe objects we read) ----------

type Id = string | { id: string } | null | undefined;

export interface StripeSubscriptionLike {
  id: string;
  customer: Id;
  status: string;
  metadata?: Record<string, string> | null;
  cancel_at_period_end?: boolean | null;
  current_period_start?: number | null;
  current_period_end?: number | null;
  trial_end?: number | null;
  items?: {
    data?: Array<{
      price?: { id?: string | null; recurring?: { interval?: string | null } | null } | null;
      current_period_start?: number | null;
      current_period_end?: number | null;
    }>;
  } | null;
}

export interface StripeEventLike {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

export interface SubscriptionRow {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string;
  price_id: string | null;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export interface ExistingSubscription {
  stripe_subscription_id: string | null;
  status: string | null;
  current_period_end: string | null;
}

export const HANDLED_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
] as const;

export function idOf(v: Id): string | null {
  if (!v) return null;
  return typeof v === "string" ? v : v.id ?? null;
}

const toIso = (s: number | null | undefined) => (typeof s === "number" && s > 0 ? new Date(s * 1000).toISOString() : null);

/** Period bounds, from the subscription (old API) or its items (new API; widest range across items). */
export function subscriptionPeriod(sub: StripeSubscriptionLike): { start: string | null; end: string | null } {
  const items = sub.items?.data ?? [];
  const starts = items.map((i) => i.current_period_start).filter((n): n is number => typeof n === "number");
  const ends = items.map((i) => i.current_period_end).filter((n): n is number => typeof n === "number");
  const start = sub.current_period_start ?? (starts.length ? Math.min(...starts) : null);
  // A trialing subscription without period data still has a trial end.
  const end = sub.current_period_end ?? (ends.length ? Math.max(...ends) : null) ?? sub.trial_end ?? null;
  return { start: toIso(start), end: toIso(end) };
}

/** Subscription id referenced by an invoice, old or new API shape. */
export function invoiceSubscriptionId(inv: Record<string, unknown>): string | null {
  const direct = idOf(inv.subscription as Id);
  if (direct) return direct;
  const parent = inv.parent as { subscription_details?: { subscription?: Id } } | null | undefined;
  const viaParent = idOf(parent?.subscription_details?.subscription);
  if (viaParent) return viaParent;
  const lines = (inv.lines as { data?: Array<Record<string, unknown>> } | undefined)?.data ?? [];
  for (const l of lines) {
    const p = l.parent as { subscription_item_details?: { subscription?: Id } } | undefined;
    const s = idOf(p?.subscription_item_details?.subscription) ?? idOf(l.subscription as Id);
    if (s) return s;
  }
  return null;
}

/** Which Stripe subscription an event is about (null = event not relevant). */
export function subscriptionIdFromEvent(event: StripeEventLike): string | null {
  const o = event.data.object;
  switch (event.type) {
    case "checkout.session.completed":
      return o.mode === "subscription" ? idOf(o.subscription as Id) : null;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return typeof o.id === "string" ? o.id : null;
    case "invoice.payment_failed":
      return invoiceSubscriptionId(o);
    default:
      return null;
  }
}

/** User id hint carried by the event itself (checkout client_reference_id / metadata). */
export function userIdHintFromEvent(event: StripeEventLike): string | null {
  const o = event.data.object;
  if (event.type === "checkout.session.completed") {
    const ref = typeof o.client_reference_id === "string" ? o.client_reference_id : null;
    const md = (o.metadata as Record<string, string> | null | undefined)?.tokeny_user_id ?? (o.metadata as Record<string, string> | null | undefined)?.supabase_user_id ?? null;
    return ref ?? md;
  }
  return null;
}

export function toSubscriptionRow(sub: StripeSubscriptionLike, userId: string): SubscriptionRow {
  const { start, end } = subscriptionPeriod(sub);
  return {
    user_id: userId,
    stripe_customer_id: idOf(sub.customer),
    stripe_subscription_id: sub.id,
    price_id: sub.items?.data?.[0]?.price?.id ?? null,
    status: sub.status,
    current_period_start: start,
    current_period_end: end,
    cancel_at_period_end: !!sub.cancel_at_period_end,
  };
}

/**
 * Guard against a late/out-of-order event for an OLD subscription clobbering a NEWER one
 * (we store one row per user). Write unless the stored row is a different subscription that is
 * still Pro while the incoming one is not.
 */
export function shouldWriteSubscription(existing: ExistingSubscription | null, incoming: SubscriptionRow, now = new Date()): boolean {
  if (!existing || !existing.stripe_subscription_id) return true;
  if (existing.stripe_subscription_id === incoming.stripe_subscription_id) return true;
  const existingPro = isProSubscription(existing, now);
  const incomingPro = isProSubscription(incoming, now);
  return !(existingPro && !incomingPro);
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface WebhookDeps {
  /** Fetch the CURRENT subscription from Stripe (ordering-safe; never trust stale event payloads). */
  retrieveSubscription(id: string): Promise<StripeSubscriptionLike>;
  /** Supabase user id stored on the Stripe customer's metadata, if any. */
  customerUserId(customerId: string): Promise<string | null>;
  /** user_id of an existing subscriptions row for this Stripe customer, if any. */
  userIdByCustomer(customerId: string): Promise<string | null>;
  getExisting(userId: string): Promise<ExistingSubscription | null>;
  /** False when the user has deleted their account (events for its canceled subscription still arrive). */
  userExists?(userId: string): Promise<boolean>;
  /** Upsert ON CONFLICT (user_id). Must throw on DB error so Stripe retries. */
  upsert(row: SubscriptionRow): Promise<void>;
  log?(msg: string, extra?: Record<string, unknown>): void;
}

export type WebhookOutcome =
  | { action: "ignored"; reason: string }
  | { action: "skipped"; reason: string; subscriptionId: string }
  | { action: "upserted"; userId: string; subscriptionId: string; status: string };

/** Handle one verified Stripe event. Throws on transient errors (→ HTTP 500 → Stripe retries). */
export async function handleStripeEvent(event: StripeEventLike, deps: WebhookDeps): Promise<WebhookOutcome> {
  if (!(HANDLED_EVENTS as readonly string[]).includes(event.type)) return { action: "ignored", reason: "unhandled_type" };
  const subId = subscriptionIdFromEvent(event);
  if (!subId) return { action: "ignored", reason: "no_subscription" };

  const sub = await deps.retrieveSubscription(subId);
  const customerId = idOf(sub.customer);

  const candidates = [
    sub.metadata?.tokeny_user_id ?? null,
    sub.metadata?.supabase_user_id ?? null,
    userIdHintFromEvent(event),
    customerId ? await deps.customerUserId(customerId) : null,
    customerId ? await deps.userIdByCustomer(customerId) : null,
  ];
  const userId = candidates.find((c): c is string => !!c && UUID_RE.test(c)) ?? null;
  if (!userId) {
    deps.log?.("stripe-webhook: no user for subscription", { subId, customerId, type: event.type });
    // Not retryable — acknowledge so Stripe stops retrying; it is logged for manual follow-up.
    return { action: "skipped", reason: "no_user", subscriptionId: subId };
  }

  if (deps.userExists && !(await deps.userExists(userId))) {
    // Account deleted (delete-account cancels the subscription first): nothing to store, don't retry.
    return { action: "skipped", reason: "user_deleted", subscriptionId: subId };
  }

  const row = toSubscriptionRow(sub, userId);
  const existing = await deps.getExisting(userId);
  if (!shouldWriteSubscription(existing, row)) {
    return { action: "skipped", reason: "older_subscription", subscriptionId: subId };
  }
  await deps.upsert(row);
  if (event.type === "invoice.payment_failed") {
    deps.log?.("stripe-webhook: invoice payment failed", { userId, subId, status: row.status });
  }
  return { action: "upserted", userId, subscriptionId: subId, status: row.status };
}

// ---------- checkout ----------

export type BillingInterval = "month" | "year";

export function parseInterval(v: unknown): BillingInterval | null {
  if (v === "month" || v === "monthly") return "month";
  if (v === "year" || v === "yearly") return "year";
  return null;
}

/** Trial days for a new checkout: only for users who never had a subscription. 0 disables. */
export function trialDaysFor(envValue: string | undefined, hadSubscriptionBefore: boolean): number {
  if (hadSubscriptionBefore) return 0;
  const n = Number.parseInt(envValue ?? "", 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, 730);
}

/** Only allow redirects back to our own app origins. */
export function safeAppUrl(requestOrigin: string | null, allowed: string[], fallback: string): string {
  if (requestOrigin && allowed.includes(requestOrigin.replace(/\/$/, ""))) return requestOrigin.replace(/\/$/, "");
  return fallback.replace(/\/$/, "");
}

/** Params for billingPortal.sessions.create. `configuration` (env STRIPE_PORTAL_CONFIGURATION) pins the
 *  Tokeny-branded portal; the Stripe account's default portal belongs to another product. Anything that is
 *  not a bpc_ id is ignored so a typo falls back to the account default instead of breaking the portal. */
export function portalSessionParams(customer: string, returnUrl: string, configuration: string | undefined) {
  const cfg = configuration?.trim();
  return { customer, return_url: returnUrl, ...(cfg && /^bpc_[A-Za-z0-9]+$/.test(cfg) ? { configuration: cfg } : {}) };
}

/** Version of the terms of service at /terms. Bump when the terms change materially. */
export const TERMS_VERSION = "2026-10-31.2"; // .2: AI features run on the user's own Anthropic key

export interface CheckoutConsent {
  terms_version: string;
  consent_at: string;
  consent_client_at: string;
  immediate_start: "true";
}

/**
 * Consent the consumer gave in the upgrade dialog (terms + request to start the digital service
 * right away, § 1823 / § 1834 OZ). Checkout is refused without it. The server timestamp is the
 * authoritative one; the client time is kept only as a hint.
 */
export function parseCheckoutConsent(v: unknown, now = new Date()): CheckoutConsent | null {
  if (!v || typeof v !== "object") return null;
  const c = v as Record<string, unknown>;
  if (c.terms !== true || c.immediateStart !== true) return null;
  const client = typeof c.at === "string" && !Number.isNaN(Date.parse(c.at)) ? new Date(c.at).toISOString() : "";
  return { terms_version: TERMS_VERSION, consent_at: now.toISOString(), consent_client_at: client, immediate_start: "true" };
}
