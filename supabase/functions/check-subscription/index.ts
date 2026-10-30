// Current plan of the calling user (read from public.subscriptions, written by stripe-webhook).
// Returns { isPro, status, interval, currentPeriodEnd, cancelAtPeriodEnd, hasCustomer }.
import { corsHeaders, getCallingUser, json, serviceClient } from "../_shared/http.ts";
import { isProSubscription } from "../_shared/plan.ts";
import { priceIds } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const user = await getCallingUser(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  try {
    const { data, error } = await serviceClient()
      .from("subscriptions")
      .select("stripe_customer_id, price_id, status, current_period_end, cancel_at_period_end")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;

    const prices = priceIds();
    const interval = data?.price_id
      ? data.price_id === prices.year ? "year" : data.price_id === prices.month ? "month" : null
      : null;
    return json({
      isPro: isProSubscription(data),
      status: data?.status ?? null,
      interval,
      currentPeriodEnd: data?.current_period_end ?? null,
      cancelAtPeriodEnd: data?.cancel_at_period_end ?? false,
      hasCustomer: !!data?.stripe_customer_id,
    });
  } catch (e) {
    console.error("check-subscription error", e instanceof Error ? e.message : e);
    return json({ error: "Internal server error" }, 500);
  }
});
