// Open the Stripe Customer Portal (manage card, switch monthly/yearly, cancel, invoices).
// Returns { url }. Requires the user to have a Stripe customer (i.e. a past or current checkout).
import { safeAppUrl } from "../_shared/billing.ts";
import { corsHeaders, getCallingUser, json, serviceClient } from "../_shared/http.ts";
import { allowedOrigins, appUrl, stripeClient } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const user = await getCallingUser(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  try {
    const { data, error } = await serviceClient()
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data?.stripe_customer_id) return json({ error: "no_customer" }, 404);

    const base = safeAppUrl(req.headers.get("origin"), allowedOrigins(), appUrl());
    const session = await stripeClient().billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: `${base}/settings`,
      locale: "cs",
    });
    return json({ url: session.url });
  } catch (e) {
    console.error("create-portal-session error", e instanceof Error ? e.message : e);
    return json({ error: "Internal server error" }, 500);
  }
});
