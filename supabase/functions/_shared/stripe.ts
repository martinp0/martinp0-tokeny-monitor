// Stripe client + env helpers shared by the billing edge functions.
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

export { Stripe };

// Pinned SDK API version. Webhook payloads may use the endpoint's (possibly newer) version; the
// webhook re-fetches the subscription through this client and _shared/billing.ts reads both the
// old and the new ("basil") shapes, so either works.
export function stripeClient(): Stripe {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key, { apiVersion: "2024-04-10", httpClient: Stripe.createFetchHttpClient() });
}

export const DEFAULT_APP_URL = "https://tokeny.martinpohl.cz";

export function appUrl(): string {
  return (Deno.env.get("APP_URL") || DEFAULT_APP_URL).replace(/\/$/, "");
}

/** Origins we redirect back to after Checkout / Portal (APP_URL + known production domains). */
export function allowedOrigins(): string[] {
  return [...new Set([appUrl(), DEFAULT_APP_URL, "https://tokeny.pohl.uk"])];
}

export function priceIds(): { month: string | null; year: string | null } {
  return {
    month: Deno.env.get("STRIPE_PRICE_MONTHLY") || null,
    year: Deno.env.get("STRIPE_PRICE_YEARLY") || null,
  };
}
