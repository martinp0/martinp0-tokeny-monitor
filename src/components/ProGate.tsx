import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UpgradeModal } from "./UpgradeModal";
import { useSubscription } from "@/hooks/useSubscription";

interface ProGateProps {
  children: React.ReactNode;
  /** Short label shown in the locked overlay, e.g. "Budget alerty" */
  featureName?: string;
}

export function ProGate({ children, featureName }: ProGateProps) {
  const { isPro, loading } = useSubscription();
  const [modalOpen, setModalOpen] = useState(false);

  if (isPro) return <>{children}</>;
  if (loading) return <div className="h-24 rounded-lg bg-white/[0.03] animate-pulse" />;

  return (
    <>
      <div className="relative">
        <div className="pointer-events-none select-none opacity-40 blur-[1px]">
          {children}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-background/60 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
            <Lock className="h-4 w-4" />
            {featureName ? `${featureName} — pouze Pro` : "Pouze Pro"}
          </div>
          <Button
            size="sm"
            className="gap-1.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0"
            onClick={() => setModalOpen(true)}
          >
            Odemknout Pro
          </Button>
        </div>
      </div>
      <UpgradeModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
