import { useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UpgradeModal } from "@/components/UpgradeModal";
import { useSubscription } from "@/hooks/useSubscription";

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
      <div className="glass border-white/[0.08] rounded-xl p-6 flex flex-col items-center gap-3 text-center">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">
            {feature ? `${feature} vyžaduje Pro` : "Tato funkce vyžaduje Pro"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Upgraduj za $7 / měsíc</p>
        </div>
        <Button
          size="sm"
          className="bg-gradient-to-r from-primary to-[hsl(320,90%,65%)] text-white"
          onClick={() => setModalOpen(true)}
        >
          Upgradovat na Pro
        </Button>
      </div>
      <UpgradeModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
