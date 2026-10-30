/**
 * Single source of truth for plans and prices.
 * Landing, Settings, UpgradeModal and ProGate all read from here.
 *
 * NOTE: prices are placeholders until the matching CZK prices exist in Stripe
 * (STRIPE_PRICE_ID). Flip `PRO_CHECKOUT_ENABLED` once checkout is live.
 */
export const PRO_CHECKOUT_ENABLED = false;

export const PRICING = {
  currency: "CZK",
  pro: {
    monthly: 99,
    yearly: 990,
  },
} as const;

export type PlanId = "free" | "pro";

/** i18n keys under `pricing.features.*` */
export const PLAN_FEATURES: Record<PlanId, string[]> = {
  free: ["dashboard", "csvImport", "currency", "calculator", "oneAlert", "mcp"],
  pro: ["everythingFree", "autoSync", "unlimitedAlerts", "forecast", "aiAgent", "exports", "sharing", "support"],
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
