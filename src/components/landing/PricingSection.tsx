import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PLAN_FEATURES, PRICING, PRO_CHECKOUT_ENABLED, PRO_TRIAL_DAYS, formatCzk } from "@/config/pricing";

type Billing = "monthly" | "yearly";

export function PricingSection({ ctaHref, signedIn = false }: { ctaHref: string; signedIn?: boolean }) {
  const { t, i18n } = useTranslation();
  const [billing, setBilling] = useState<Billing>("monthly");
  const locale = i18n.language?.startsWith("en") ? "en-GB" : "cs-CZ";
  const proPrice =
    billing === "monthly"
      ? t("pricing.perMonth", { price: formatCzk(PRICING.pro.monthly, locale) })
      : t("pricing.perYear", { price: formatCzk(PRICING.pro.yearly, locale) });

  return (
    <section id="pricing" className="scroll-mt-20 px-4 sm:px-6 py-20 md:py-28 max-w-5xl mx-auto">
      <div className="text-center mb-10">
        <p className="eyebrow mb-3">{t("pricing.eyebrow")}</p>
        <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-4">{t("pricing.title")}</h2>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">{t("pricing.subtitle")}</p>
      </div>

      <div className="flex justify-center mb-8">
        <div role="radiogroup" aria-label={t("pricing.eyebrow")} className="inline-flex rounded-full bg-muted p-1">
          {(["monthly", "yearly"] as const).map((b) => (
            <button
              key={b}
              type="button"
              role="radio"
              aria-checked={billing === b}
              onClick={() => setBilling(b)}
              className={cn(
                "tap-target rounded-full px-5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                billing === b ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`pricing.${b}`)}
              {b === "yearly" && (
                <span className="ml-2 text-xs font-semibold text-success">{t("pricing.yearlySave")}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 md:gap-6">
        <div className="surface rounded-3xl p-6 md:p-8 flex flex-col">
          <h3 className="text-xl font-semibold">{t("pricing.free")}</h3>
          <p className="text-muted-foreground mt-1 mb-6">{t("pricing.freeDesc")}</p>
          <p className="text-4xl font-semibold tracking-tight tabular-nums mb-6">{t("pricing.freePrice")}</p>
          <FeatureList keys={PLAN_FEATURES.free} />
          <Button asChild variant="outline" size="lg" className="mt-8 w-full">
            <Link to={ctaHref}>{t("pricing.notify")}</Link>
          </Button>
        </div>

        <div className="surface rounded-3xl p-6 md:p-8 flex flex-col ring-2 ring-primary">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xl font-semibold">{t("pricing.pro")}</h3>
            {!PRO_CHECKOUT_ENABLED && (
              <span className="rounded-full bg-primary/10 text-primary text-xs font-semibold px-3 py-1">
                {t("pricing.soon")}
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-1 mb-6">{t("pricing.proDesc")}</p>
          <p className="text-4xl font-semibold tracking-tight tabular-nums mb-6" aria-live="polite">
            {proPrice}
          </p>
          <FeatureList keys={PLAN_FEATURES.pro} />
          {/* Signed-in visitors go straight to the plan picker in Settings (keeps the landing
              bundle free of the Supabase client). */}
          <Button asChild size="lg" className="mt-8 w-full">
            <Link to={PRO_CHECKOUT_ENABLED && signedIn ? `/settings?upgrade=${billing}` : ctaHref}>
              {!PRO_CHECKOUT_ENABLED
                ? t("pricing.notify")
                : PRO_TRIAL_DAYS > 0
                  ? t("pricing.trialShort", { days: PRO_TRIAL_DAYS })
                  : t("pricing.upgrade")}
            </Link>
          </Button>
        </div>
      </div>
      <p className="text-center text-sm text-muted-foreground mt-6">{t("pricing.vatNote")}</p>
    </section>
  );
}

function FeatureList({ keys }: { keys: string[] }) {
  const { t } = useTranslation();
  return (
    <ul className="space-y-3 text-[15px]">
      {keys.map((k) => (
        <li key={k} className="flex items-start gap-3">
          <Check className="h-5 w-5 shrink-0 text-primary mt-px" aria-hidden />
          <span>{t(`pricing.features.${k}`)}</span>
        </li>
      ))}
    </ul>
  );
}
