import { useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { UpgradeModal } from "@/components/UpgradeModal";
import { useSubscription } from "@/hooks/useSubscription";
import { PRICING, formatCzk } from "@/config/pricing";
import type { ProFeature } from "@/lib/plan";

interface Props {
  feature: ProFeature;
  children: ReactNode;
  /** Compact inline variant (for toolbars) instead of the card. */
  compact?: boolean;
  /** Render nothing for free users (when an upsell elsewhere is enough). */
  hideWhenLocked?: boolean;
}

/**
 * UI mirror of the server-side Pro checks. Never the only protection: every Pro feature is also
 * enforced in edge functions / RLS (see supabase/functions/_shared/plan.ts).
 */
export function ProGate({ feature, children, compact, hideWhenLocked }: Props) {
  const { isPro, loading } = useSubscription();
  const { t, i18n } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const locale = i18n.language?.startsWith("en") ? "en-GB" : "cs-CZ";

  if (loading) return null;
  if (isPro) return <>{children}</>;
  if (hideWhenLocked) return null;

  const title = t("pricing.proRequired", { feature: t(`pricing.featureNames.${feature}`) });

  return (
    <>
      {compact ? (
        <Button variant="outline" size="sm" onClick={() => setModalOpen(true)} aria-label={title} title={title}>
          <Lock className="h-4 w-4 mr-1.5" aria-hidden />
          {t(`pricing.featureNames.${feature}`)}
        </Button>
      ) : (
        <div className="surface rounded-2xl p-6 flex flex-col items-center gap-3 text-center">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("pricing.fromPrice", {
                price: t("pricing.perMonth", { price: formatCzk(PRICING.pro.monthly, locale) }),
              })}
            </p>
          </div>
          <Button size="sm" onClick={() => setModalOpen(true)}>
            {t("pricing.upgrade")}
          </Button>
        </div>
      )}
      <UpgradeModal open={modalOpen} onOpenChange={setModalOpen} feature={feature} />
    </>
  );
}
