import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/hooks/useSubscription";
import {
  PLAN_FEATURES,
  PRICING,
  PRO_CHECKOUT_ENABLED,
  PRO_TRIAL_DAYS,
  formatCzk,
  type BillingInterval,
} from "@/config/pricing";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Feature that triggered the modal (ProFeature id), shown in the title. */
  feature?: string;
  /** Preselected billing interval (default: yearly). */
  defaultInterval?: BillingInterval;
}

export function UpgradeModal({ open, onOpenChange, feature, defaultInterval = "year" }: Props) {
  const { startCheckout, hasCustomer } = useSubscription();
  const { t, i18n } = useTranslation();
  const [interval, setBillingInterval] = useState<BillingInterval>(defaultInterval);
  const [consent, setConsent] = useState(false);
  useEffect(() => {
    if (open) {
      setBillingInterval(defaultInterval);
      setConsent(false);
    }
  }, [open, defaultInterval]);
  const [loading, setLoading] = useState(false);
  const locale = i18n.language?.startsWith("en") ? "en-GB" : "cs-CZ";
  const price =
    interval === "month"
      ? t("pricing.perMonth", { price: formatCzk(PRICING.pro.monthly, locale) })
      : t("pricing.perYear", { price: formatCzk(PRICING.pro.yearly, locale) });
  // Trial only for first-time subscribers (server decides; this is just the copy).
  const showTrial = PRO_TRIAL_DAYS > 0 && !hasCustomer;

  async function handleUpgrade() {
    setLoading(true);
    await startCheckout(interval, consent);
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {feature
              ? t("pricing.proRequired", { feature: t(`pricing.featureNames.${feature}`, { defaultValue: feature }) })
              : t("pricing.upgrade")}
          </DialogTitle>
          <DialogDescription>{t("pricing.proDesc")}</DialogDescription>
        </DialogHeader>

        <div role="radiogroup" aria-label={t("pricing.chooseInterval")} className="grid grid-cols-2 gap-2">
          {(["month", "year"] as const).map((iv) => (
            <button
              key={iv}
              type="button"
              role="radio"
              aria-checked={interval === iv}
              onClick={() => setBillingInterval(iv)}
              className={cn(
                "rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                interval === iv ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
              )}
            >
              <span className="block text-sm font-medium">{t(iv === "month" ? "pricing.monthly" : "pricing.yearly")}</span>
              <span className="block tabular-nums font-semibold">
                {formatCzk(iv === "month" ? PRICING.pro.monthly : PRICING.pro.yearly, locale)}
              </span>
              {iv === "year" && <span className="block text-xs font-semibold text-success">{t("pricing.yearlySave")}</span>}
            </button>
          ))}
        </div>

        <ul className="space-y-2.5 my-2">
          {PLAN_FEATURES.pro.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-[15px]">
              <Check className="h-5 w-5 text-primary shrink-0" aria-hidden />
              {t(`pricing.features.${f}`)}
            </li>
          ))}
        </ul>

        {PRO_CHECKOUT_ENABLED && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-border p-3">
            <Checkbox
              id="upgrade-consent"
              checked={consent}
              onCheckedChange={(v) => setConsent(v === true)}
              className="mt-0.5"
              aria-required="true"
            />
            <label htmlFor="upgrade-consent" className="text-xs leading-snug text-muted-foreground">
              {t("pricing.consentBefore")}
              <Link to="/terms" target="_blank" rel="noopener" className="underline text-foreground">
                {t("pricing.consentLink")}
              </Link>
              {t("pricing.consentAfter")}
            </label>
          </div>
        )}

        <Button size="lg" className="w-full" onClick={handleUpgrade} disabled={loading || !PRO_CHECKOUT_ENABLED || !consent}>
          {!PRO_CHECKOUT_ENABLED
            ? t("pricing.soon")
            : loading
              ? t("pricing.redirecting")
              : showTrial
                ? t("pricing.trialShort", { days: PRO_TRIAL_DAYS })
                : t("pricing.upgrade")}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {showTrial ? `${t("pricing.trial", { days: PRO_TRIAL_DAYS, price })}. ` : `${price}. `}
          {t("pricing.vatNote")}
        </p>
      </DialogContent>
    </Dialog>
  );
}
