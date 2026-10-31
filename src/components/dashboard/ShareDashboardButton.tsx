import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShareDialog } from "@/components/share/ShareDialog";

/** Toolbar button; wrapped in <ProGate feature="sharing" compact> by the dashboard. */
export function ShareDashboardButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5 border-border hover:bg-secondary hover:text-foreground tabular-nums text-xs">
        <Share2 className="h-3.5 w-3.5" aria-hidden /> {t("share.button")}
      </Button>
      <ShareDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
