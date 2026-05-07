import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Share2, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export function ShareDashboardButton() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function createShare() {
    if (!session) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("shared_dashboards")
      .insert({ user_id: session.user.id, label: label || "Sdílený dashboard" } as any)
      .select("share_token")
      .single();

    if (error) {
      toast.error(error.message);
      setCreating(false);
      return;
    }

    const url = `${window.location.origin}/shared/${data.share_token}`;
    setShareUrl(url);
    setCreating(false);
  }

  function copyUrl() {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      toast.success("Odkaz zkopírován");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setShareUrl(null); setLabel(""); } }}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-border hover:bg-secondary hover:text-foreground font-mono text-xs"
        >
          <Share2 className="h-3.5 w-3.5" />
          Sdílet
        </Button>
      </DialogTrigger>
      <DialogContent className="glass border-white/[0.08] max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 gradient-text">
            <Share2 className="h-5 w-5" />
            Sdílet dashboard
          </DialogTitle>
        </DialogHeader>
        {!shareUrl ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Vytvoř veřejný read-only odkaz na tvůj dashboard. Kdokoliv s odkazem uvidí tvá data.
            </p>
            <div>
              <Label className="text-xs">Název (volitelné)</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Např. Květen 2026"
                className="mt-1 font-mono"
              />
            </div>
            <Button onClick={createShare} disabled={creating} className="w-full gap-2">
              <Share2 className="h-4 w-4" />
              {creating ? "Vytvářím…" : "Vytvořit sdílený odkaz"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-accent/10 border border-accent/30 p-3 space-y-2">
              <div className="text-xs font-semibold text-accent">Odkaz vytvořen!</div>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono flex-1 break-all">{shareUrl}</code>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copyUrl}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <a href={shareUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full gap-2 font-mono text-xs">
                <ExternalLink className="h-3.5 w-3.5" />
                Otevřít v novém okně
              </Button>
            </a>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
