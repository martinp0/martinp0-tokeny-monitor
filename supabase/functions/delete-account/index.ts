// Deletes the caller's account. Ends any Stripe subscription first (immediately, no proration
// credit), then deletes the user's rows and the auth user. Logic + tests: _shared/account-deletion.ts.
import { deleteAccount, type BillingDeps, type StripeSubLite } from "../_shared/account-deletion.ts";
import { corsHeaders, getCallingUser, json, serviceClient } from "../_shared/http.ts";
import { stripeClient } from "../_shared/stripe.ts";

function stripeBilling(): BillingDeps | null {
  if (!Deno.env.get("STRIPE_SECRET_KEY")) return null;
  const stripe = stripeClient();
  return {
    listSubscriptions: async (customer) => {
      const out: StripeSubLite[] = [];
      for await (const s of stripe.subscriptions.list({ customer, status: "all", limit: 100 })) {
        out.push({ id: s.id, status: s.status });
      }
      return out;
    },
    cancelSubscription: async (id) => {
      await stripe.subscriptions.cancel(id, { prorate: false, invoice_now: false });
    },
    markCustomerDeleted: async (customer) => {
      await stripe.customers.update(customer, {
        metadata: { supabase_user_id: "", tokeny_account_deleted_at: new Date().toISOString() },
      });
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const user = await getCallingUser(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const svc = serviceClient();
  try {
    const result = await deleteAccount(user.id, {
      customerIdFor: async (userId) => {
        const { data, error } = await svc.from("subscriptions").select("stripe_customer_id").eq("user_id", userId).maybeSingle();
        if (error) throw new Error(error.message);
        return (data?.stripe_customer_id as string | undefined) || null;
      },
      billing: stripeBilling(),
      deleteRows: async (table, userId) => {
        const { error } = await svc.from(table).delete().eq("user_id", userId);
        // A table that doesn't exist in this deployment is fine; anything else aborts.
        if (error && error.code !== "42P01" && error.code !== "PGRST205") throw new Error(`${table}: ${error.message}`);
      },
      deleteAuthUser: async (userId) => {
        const { error } = await svc.auth.admin.deleteUser(userId);
        if (error) throw new Error(error.message);
      },
      log: (msg, extra) => console.log(msg, JSON.stringify(extra ?? {})),
    });
    if (!result.ok) {
      const message =
        result.error === "delete_failed"
          ? "Smazání se nepovedlo, zkus to prosím znovu."
          : "Nepodařilo se ukončit předplatné Pro, účet zatím nemažeme. Zkus to prosím znovu, nebo napiš na podporu.";
      return json({ error: message, code: result.error }, result.error === "delete_failed" ? 500 : 502);
    }
    return json({ success: true, subscriptionCanceled: result.billing.canceled.length > 0 });
  } catch (e) {
    console.error("delete-account error", e instanceof Error ? e.message : e);
    return json({ error: "Internal server error" }, 500);
  }
});
