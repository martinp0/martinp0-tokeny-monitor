// Stripe webhook → public.subscriptions (one row per user, written only here, service role).
//
// Events (configure exactly these on the endpoint):
//   checkout.session.completed, customer.subscription.created, customer.subscription.updated,
//   customer.subscription.deleted, invoice.payment_failed
//
// Every event re-fetches the CURRENT subscription from Stripe, so out-of-order delivery and
// retries are harmless (idempotent upsert). The decision logic lives in _shared/billing.ts
// (unit-tested). Returns 500 on transient errors so Stripe retries; 200 for everything else.
import { handleStripeEvent, type StripeSubscriptionLike, type SubscriptionRow } from "../_shared/billing.ts";
import { serviceClient } from "../_shared/http.ts";
import { stripeClient, type Stripe } from "../_shared/stripe.ts";

const headers = { "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("stripe-webhook: STRIPE_WEBHOOK_SECRET is not configured");
    return new Response(JSON.stringify({ error: "Not configured" }), { status: 503, headers });
  }
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response(JSON.stringify({ error: "Missing stripe-signature" }), { status: 400, headers });

  const stripe = stripeClient();
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err) {
    console.error("stripe-webhook: signature verification failed", err instanceof Error ? err.message : err);
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400, headers });
  }

  const svc = serviceClient();
  try {
    const outcome = await handleStripeEvent(event as unknown as { id: string; type: string; data: { object: Record<string, unknown> } }, {
      retrieveSubscription: async (id) =>
        (await stripe.subscriptions.retrieve(id)) as unknown as StripeSubscriptionLike,
      customerUserId: async (customerId) => {
        const c = await stripe.customers.retrieve(customerId);
        if ((c as { deleted?: boolean }).deleted) return null;
        return (c as Stripe.Customer).metadata?.supabase_user_id ?? null;
      },
      userIdByCustomer: async (customerId) => {
        const { data, error } = await svc
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .limit(1)
          .maybeSingle();
        if (error) throw new Error(error.message);
        return (data?.user_id as string | undefined) ?? null;
      },
      getExisting: async (userId) => {
        const { data, error } = await svc
          .from("subscriptions")
          .select("stripe_subscription_id, status, current_period_end")
          .eq("user_id", userId)
          .maybeSingle();
        if (error) throw new Error(error.message);
        return data ?? null;
      },
      upsert: async (row: SubscriptionRow) => {
        const { error } = await svc
          .from("subscriptions")
          .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
        if (error) throw new Error(error.message);
      },
      log: (msg, extra) => console.warn(msg, JSON.stringify(extra ?? {})),
    });
    console.log("stripe-webhook", event.type, event.id, JSON.stringify(outcome));
    return new Response(JSON.stringify({ received: true, ...outcome }), { status: 200, headers });
  } catch (e) {
    console.error("stripe-webhook: handler error", event.type, event.id, e instanceof Error ? e.message : e);
    return new Response(JSON.stringify({ error: "Webhook handler failed" }), { status: 500, headers });
  }
});
