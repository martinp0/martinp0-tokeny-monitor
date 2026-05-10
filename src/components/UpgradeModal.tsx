import { useState } from "react";
import { Sparkles, Check, Loader2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";

const PRO_FEATURES = [
  "Budget alerty na e-mail",
  "Merge více CSV naráz",
  "Týmové sdílení dashboardu",
  "Prioritní podpora",
];

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpgradeModal({ open, onOpenChange }: UpgradeModalProps) {
  const { startCheckout } = useSubscription();
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    setLoading(true);
    try {
      await startCheckout();
    } catch {
      toast.error("Nepodařilo se otevřít platební bránu");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border-white/[0.08] max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 gradient-text text-xl">
            <Sparkles className="h-5 w-5 text-violet-400" />
            Upgrade na Pro
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="text-center">
            <div className="text-3xl font-mono font-bold gradient-text">$7</div>
            <div className="text-xs text-muted-foreground font-mono">/ měsíc</div>
          </div>

          <ul className="space-y-2">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm">
                <Check className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          <Button
            className="w-full gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0"
            onClick={handleUpgrade}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Přesměrování…" : "Pokračovat na platbu"}
          </Button>

          <p className="text-[10px] text-center text-muted-foreground">
            Platba přes Stripe. Zrušení kdykoliv.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
