import { useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UpgradeModal } from "@/components/UpgradeModal";
import { useSubscription } from "@/hooks/useSubscription";
import { PRICING, formatCzk } from "@/config/pricing";

interface Props {
  feature?: string;
  children: ReactNode;
}

export function ProGate({ feature, children }: Props) {
  const { isPro, loading } = useSubscription();
  const [modalOpen, setModalOpen] = useState(false);

  if (loading) return null;
  if (isPro) return <>{children}</>;

  return (
    <>
      <div className="surface rounded-2xl p-6 flex flex-col items-center gap-3 text-center">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">
            {feature ? `${feature} vyžaduje Pro` : "Tato funkce vyžaduje Pro"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Pro za {formatCzk(PRICING.pro.monthly)} / měsíc</p>
        </div>
        <Button
          size="sm"
                    onClick={() => setModalOpen(true)}
        >
          Upgradovat na Pro
        </Button>
      </div>
      <UpgradeModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
