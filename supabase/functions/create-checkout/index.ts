// Start a Stripe Checkout session for Tokeny Pro.
//
// Body: { interval: "month" | "year" }   (defaults to "month")
// Prices come from env STRIPE_PRICE_MONTHLY / STRIPE_PRICE_YEARLY. Optional free trial from
// STRIPE_TRIAL_DAYS (e.g. 14) — only for users who never had a subscription.
// Returns { url } (redirect the browser there) or 409 { error: "already_pro" } → use the portal.
import { parseInterval, trialDaysFor, safeAppUrl } from "../_shared/billing.ts";
import { corsHeaders, getCallingUser, json, serviceClient } from "../_shared/http.ts";
import { isProSubscription } from "../_shared/plan.ts";
import { allowedOrigins, appUrl, priceIds, stripeClient, type Stripe } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const user = await getCallingUser(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  try {
    const body = await req.json().catch(() => ({}));
    const interval = parseInterval(body?.interval ?? "month");
    if (!interval) return json({ error: "interval must be 'month' or 'year'" }, 400);
    const priceId = priceIds()[interval];
    if (!priceId) {
      console.error(`create-checkout: STRIPE_PRICE_${interval === "month" ? "MONTHLY" : "YEARLY"} is not configured`);
      return json({ error: "Checkout is not configured" }, 503);
    }

    const svc = serviceClient();
    const { data: existing, error: exErr } = await svc
      .from("subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, status, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle();
    if (exErr) throw exErr;
    if (isProSubscription(existing)) return json({ error: "already_pro" }, 409);

    const stripe = stripeClient();

    // Reuse the Stripe customer: DB row first, then a customer we created earlier (metadata).
    let customerId: string | null = existing?.stripe_customer_id ?? null;
    if (!customerId) {
      const found = await stripe.customers.search({ query: `metadata['supabase_user_id']:'${user.id}'`, limit: 1 });
      customerId = found.data[0]?.id ?? null;
    }
    if (!customerId) {
      const customer = await stripe.customers.create(
        { email: user.email, metadata: { supabase_user_id: user.id } },
        { idempotencyKey: `tokeny-customer-${user.id}` },
      );
      customerId = customer.id;
    }

    const trialDays = trialDaysFor(Deno.env.get("STRIPE_TRIAL_DAYS"), !!existing?.stripe_subscription_id);
    const base = safeAppUrl(req.headers.get("origin"), allowedOrigins(), appUrl());

    const params: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/settings?checkout=success`,
      cancel_url: `${base}/settings?checkout=canceled`,
      allow_promotion_codes: true,
      locale: "cs",
      metadata: { supabase_user_id: user.id, app: "tokeny" },
      subscription_data: {
        metadata: { supabase_user_id: user.id, app: "tokeny" },
        ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
      },
    };
    const session = await stripe.checkout.sessions.create(params);
    return json({ url: session.url });
  } catch (e) {
    console.error("create-checkout error", e instanceof Error ? e.message : e);
    return json({ error: "Internal server error" }, 500);
  }
});
