// Stripe Pro billing: checkout, customer portal, subscription status, webhook, account-deletion hooks.
import Stripe from "stripe";
import type { Db } from "./db.js";
import { handleStripeEvent, parseCheckoutConsent, parseInterval, portalSessionParams, safeAppUrl, trialDaysFor, type StripeSubscriptionLike } from "./lib/billing.js";
import type { BillingDeps, StripeSubLite } from "./lib/account-deletion.js";
import { isProSubscription } from "./lib/plan.js";
import { getSubscription, upsertSubscription, userExists, userIdByCustomer } from "./repo.js";

export const DEFAULT_APP_URL = "https://tokeny.martinpohl.cz";
export const appUrl = () => (process.env.APP_URL || DEFAULT_APP_URL).replace(/\/$/, "");
export const allowedOrigins = () => [...new Set([appUrl(), DEFAULT_APP_URL, "https://tokeny.pohl.uk"])];
export const priceIds = () => ({ month: process.env.STRIPE_PRICE_MONTHLY || null, year: process.env.STRIPE_PRICE_YEARLY || null });
export const stripeConfigured = () => !!process.env.STRIPE_SECRET_KEY;

let client: Stripe | null = null;
export function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  // Pinned API version; lib/billing.ts reads both the old and the "basil" subscription shapes.
  // deno-lint-ignore no-explicit-any
  client ??= new Stripe(key, { apiVersion: "2024-04-10" as any });
  return client;
}

export interface Result { status: number; body: unknown }

export async function subscriptionStatus(db: Db, userId: string) {
  const sub = await getSubscription(db, userId);
  const prices = priceIds();
  const interval = !sub?.price_id ? null : sub.price_id === prices.month ? "month" : sub.price_id === prices.year ? "year" : null;
  return {
    isPro: isProSubscription(sub),
    status: sub?.status ?? null,
    interval,
    currentPeriodEnd: sub?.current_period_end ?? null,
    cancelAtPeriodEnd: !!sub?.cancel_at_period_end,
    hasCustomer: !!sub?.stripe_customer_id,
  };
}

export async function createCheckout(
  db: Db,
  user: { id: string; email: string | null },
  body: { interval?: unknown; consent?: unknown },
  origin: string | null,
): Promise<Result> {
  const interval = parseInterval(body?.interval ?? "month");
  if (!interval) return { status: 400, body: { error: "interval must be 'month' or 'year'" } };
  const consent = parseCheckoutConsent(body?.consent);
  if (!consent) return { status: 400, body: { error: "consent_required" } };
  const priceId = priceIds()[interval];
  if (!priceId || !stripeConfigured()) {
    console.error(`checkout: Stripe or STRIPE_PRICE_${interval === "month" ? "MONTHLY" : "YEARLY"} not configured`);
    return { status: 503, body: { error: "Checkout is not configured" } };
  }
  const existing = await getSubscription(db, user.id);
  if (isProSubscription(existing)) return { status: 409, body: { error: "already_pro" } };
  const stripe = stripeClient();
  let customerId = existing?.stripe_customer_id || null;
  if (!customerId) {
    const found = await stripe.customers.search({ query: `metadata['tokeny_user_id']:'${user.id}'`, limit: 1 });
    customerId = found.data[0]?.id ?? null;
  }
  if (!customerId) {
    const customer = await stripe.customers.create(
      { email: user.email ?? undefined, metadata: { tokeny_user_id: user.id } },
      { idempotencyKey: `tokeny-customer-${user.id}` },
    );
    customerId = customer.id;
  }
  const trialDays = trialDaysFor(process.env.STRIPE_TRIAL_DAYS, !!existing?.stripe_subscription_id);
  const base = safeAppUrl(origin, allowedOrigins(), appUrl());
  const metadata = { tokeny_user_id: user.id, app: "tokeny", ...consent };
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${base}/settings?checkout=success`,
    cancel_url: `${base}/settings?checkout=canceled`,
    allow_promotion_codes: true,
    locale: "cs",
    custom_text: { submit: { message: `Platí obchodní podmínky Tokeny: ${appUrl()}/terms` } },
    metadata,
    subscription_data: { metadata, ...(trialDays > 0 ? { trial_period_days: trialDays } : {}) },
  });
  return { status: 200, body: { url: session.url } };
}

export async function createPortal(db: Db, userId: string, origin: string | null): Promise<Result> {
  if (!stripeConfigured()) return { status: 503, body: { error: "Billing is not configured" } };
  const sub = await getSubscription(db, userId);
  if (!sub?.stripe_customer_id) return { status: 404, body: { error: "no_customer" } };
  const base = safeAppUrl(origin, allowedOrigins(), appUrl());
  const session = await stripeClient().billingPortal.sessions.create(
    portalSessionParams(sub.stripe_customer_id, `${base}/settings`, process.env.STRIPE_PORTAL_CONFIGURATION),
  );
  return { status: 200, body: { url: session.url } };
}

export async function stripeWebhook(db: Db, rawBody: string, signature: string | null): Promise<Result> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !stripeConfigured()) return { status: 503, body: { error: "Not configured" } };
  if (!signature) return { status: 400, body: { error: "Missing stripe-signature" } };
  const stripe = stripeClient();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret);
  } catch (err) {
    console.error("stripe-webhook: signature verification failed", err instanceof Error ? err.message : err);
    return { status: 400, body: { error: "Invalid signature" } };
  }
  try {
    const outcome = await handleStripeEvent(event as unknown as { id: string; type: string; data: { object: Record<string, unknown> } }, {
      retrieveSubscription: async (id) => (await stripe.subscriptions.retrieve(id)) as unknown as StripeSubscriptionLike,
      customerUserId: async (customerId) => {
        const c = await stripe.customers.retrieve(customerId);
        if ((c as { deleted?: boolean }).deleted) return null;
        const md = (c as Stripe.Customer).metadata ?? {};
        return md.tokeny_user_id || md.supabase_user_id || null;
      },
      userIdByCustomer: (customerId) => userIdByCustomer(db, customerId),
      getExisting: (userId) => getSubscription(db, userId),
      userExists: (userId) => userExists(db, userId),
      upsert: (row) => upsertSubscription(db, row),
      log: (msg, extra) => console.warn(msg, JSON.stringify(extra ?? {})),
    });
    console.log("stripe-webhook", event.type, event.id, JSON.stringify(outcome));
    return { status: 200, body: { received: true, ...outcome } };
  } catch (e) {
    console.error("stripe-webhook: handler error", event.type, event.id, e instanceof Error ? e.message : e);
    return { status: 500, body: { error: "Webhook handler failed" } };
  }
}

/** Stripe hooks for account deletion; null when Stripe isn't configured. */
export function stripeBilling(): BillingDeps | null {
  if (!stripeConfigured()) return null;
  const stripe = stripeClient();
  return {
    listSubscriptions: async (customer) => {
      const out: StripeSubLite[] = [];
      for await (const s of stripe.subscriptions.list({ customer, status: "all", limit: 100 })) out.push({ id: s.id, status: s.status });
      return out;
    },
    cancelSubscription: async (id) => {
      await stripe.subscriptions.cancel(id, { prorate: false, invoice_now: false });
    },
    markCustomerDeleted: async (customer) => {
      await stripe.customers.update(customer, {
        metadata: { tokeny_user_id: "", supabase_user_id: "", tokeny_account_deleted_at: new Date().toISOString() },
      });
    },
  };
}
