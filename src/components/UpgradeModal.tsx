import { useState } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { PLAN_FEATURES, PRICING, PRO_CHECKOUT_ENABLED, formatCzk } from "@/config/pricing";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpgradeModal({ open, onOpenChange }: Props) {
  const { startCheckout } = useSubscription();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    setLoading(true);
    await startCheckout();
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xl">{t("pricing.upgrade")}</DialogTitle>
          <DialogDescription>
            <span className="tabular-nums font-semibold text-foreground">
              {t("pricing.perMonth", { price: formatCzk(PRICING.pro.monthly) })}
            </span>{" "}
            · {t("pricing.perYear", { price: formatCzk(PRICING.pro.yearly) })}
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2.5 my-2">
          {PLAN_FEATURES.pro.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-[15px]">
              <Check className="h-5 w-5 text-primary shrink-0" aria-hidden />
              {t(`pricing.features.${f}`)}
            </li>
          ))}
        </ul>

        <Button size="lg" className="w-full" onClick={handleUpgrade} disabled={loading || !PRO_CHECKOUT_ENABLED}>
          {!PRO_CHECKOUT_ENABLED ? t("pricing.soon") : loading ? "…" : t("pricing.upgrade")}
        </Button>
        {!PRO_CHECKOUT_ENABLED && <p className="text-center text-xs text-muted-foreground">{t("pricing.vatNote")}</p>}
      </DialogContent>
    </Dialog>
  );
}
