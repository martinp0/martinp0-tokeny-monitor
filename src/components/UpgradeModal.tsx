import { useState } from "react";
import { Zap, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";

const PRO_FEATURES = [
  "Neomezené budget alerty",
  "AI agent chat s historií",
  "Exporty do CSV a PDF",
  "Predikce nákladů (AI Forecast)",
  "Prioritní podpora",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpgradeModal({ open, onOpenChange }: Props) {
  const { startCheckout } = useSubscription();
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    setLoading(true);
    await startCheckout();
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border-white/[0.08] max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-primary" />
            Upgradovat na Pro
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Odemkni plný výkon Tokeny monitoru za{" "}
            <span className="font-mono font-bold text-foreground">$7 / měsíc</span>
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 my-2">
          {PRO_FEATURES.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-primary shrink-0" />
              {f}
            </li>
          ))}
        </ul>

        <Button
          className="w-full bg-gradient-to-r from-primary to-[hsl(320,90%,65%)] text-white"
          onClick={handleUpgrade}
          disabled={loading}
        >
          {loading ? "Přesměrovávám…" : "Upgradovat na Pro"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
