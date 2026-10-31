/**
 * Single source of truth for plans and prices (UI side).
 * Landing, Settings, UpgradeModal and ProGate all read from here.
 *
 * Stripe (live, account martinpohl.cz): product "Tokeny Pro" (prod_VXDr0XHK7gteJO)
 *   monthly 99 Kč  → price_1UW9Py6jFD9ux2ZIFyLZKM6k (lookup_key tokeny_pro_monthly)
 *   yearly 990 Kč  → price_1UW9Pz6jFD9ux2ZIzt5tYuVw (lookup_key tokeny_pro_yearly)
 * The edge functions read the price ids from STRIPE_PRICE_MONTHLY / STRIPE_PRICE_YEARLY; the
 * amounts here are display-only and must match Stripe. Limits are enforced server-side
 * (server/lib/plan.ts, enforced by the /api routes) — the UI only mirrors them.
 */
import { FREE_LIMITS } from "@/lib/plan";

export const PRO_CHECKOUT_ENABLED = true;

/** Free trial for first-time subscribers (must match STRIPE_TRIAL_DAYS; 0 hides the copy). */
export const PRO_TRIAL_DAYS = 14;

export const PRICING = {
  currency: "CZK",
  pro: {
    monthly: 99,
    yearly: 990,
  },
} as const;

export { FREE_LIMITS };

export type PlanId = "free" | "pro";
export type BillingInterval = "month" | "year";

/** i18n keys under `pricing.features.*` */
export const PLAN_FEATURES: Record<PlanId, string[]> = {
  free: ["dashboard", "oneProvider", "history30", "csvImport", "currency", "calculator", "aiAgent"],
  pro: [
    "everythingFree",
    "unlimitedProviders",
    "fullHistory",
    "autoSync",
    "budgetAlerts",
    "forecast",
    "exports",
    "sharing",
    "mcp",
  ],
};

export function formatCzk(amount: number, locale = "cs-CZ") {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(amount);
}

/** e.g. "99 Kč / měsíc" */
export function proMonthlyLabel(t: (k: string, o?: Record<string, unknown>) => string, locale?: string) {
  return t("pricing.perMonth", { price: formatCzk(PRICING.pro.monthly, locale) });
}

/** Two months free when paying yearly. */
export const YEARLY_SAVING_MONTHS = Math.round(12 - PRICING.pro.yearly / PRICING.pro.monthly);
