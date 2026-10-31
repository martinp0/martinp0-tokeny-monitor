import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrency } from "@/hooks/useCurrency";
import { pragueToday } from "@/lib/share";

type Group = "day" | "provider" | "model" | "day_provider_model";
type Format = "csv" | "json";

/** Server-side usage export (Pro; /api/export enforces it). Downloads CSV or JSON. */
export function ExportDialog({ open, onOpenChange, range }: { open: boolean; onOpenChange: (o: boolean) => void; range?: { from: Date; to: Date } | null }) {
  const { t, i18n } = useTranslation();
  const { currency, exchangeRate } = useCurrency();
  const today = pragueToday();
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [group, setGroup] = useState<Group>("day_provider_model");
  const [format, setFormat] = useState<Format>("csv");
  const [busy, setBusy] = useState(false);
  const idFrom = useId(), idTo = useId();

  useEffect(() => {
    if (open && range) { setFrom(pragueToday(range.from)); setTo(pragueToday(range.to)); }
  }, [open, range]);

  const tooLong = (Date.parse(to) - Date.parse(from)) / 86_400_000 > 730;

  async function download() {
    setBusy(true);
    try {
      const qs = new URLSearchParams({ from, to, group, format, currency, lang: i18n.language?.startsWith("en") ? "en" : "cs" });
      const res = await fetch(`/api/export?${qs}`, { credentials: "same-origin" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error === "range_too_long" ? t("exportData.rangeError") : body?.message || body?.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `tokeny-${group}-${from}_${to}.${format}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast.success(t("exportData.done"));
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const rate = exchangeRate.toLocaleString(i18n.language?.startsWith("en") ? "en-GB" : "cs-CZ", { maximumFractionDigits: 3 });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-primary" aria-hidden /> {t("exportData.title")}</DialogTitle>
          <DialogDescription>{t("exportData.intro")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor={idFrom}>{t("exportData.from")}</Label><Input id={idFrom} type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor={idTo}>{t("exportData.to")}</Label><Input id={idTo} type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
          {tooLong && <p className="text-xs text-destructive">{t("exportData.rangeError")}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("exportData.group")}</Label>
              <Select value={group} onValueChange={(v) => setGroup(v as Group)}>
                <SelectTrigger aria-label={t("exportData.group")}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="day_provider_model">{t("exportData.groupAll")}</SelectItem>
                  <SelectItem value="day">{t("exportData.groupDay")}</SelectItem>
                  <SelectItem value="provider">{t("exportData.groupProvider")}</SelectItem>
                  <SelectItem value="model">{t("exportData.groupModel")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("exportData.format")}</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
                <SelectTrigger aria-label={t("exportData.format")}><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="csv">CSV</SelectItem><SelectItem value="json">JSON</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground rounded-2xl bg-secondary/50 px-3 py-2">
            {currency === "CZK" ? t("exportData.noteCzk", { rate }) : t("exportData.noteUsd")}
          </p>
          <Button onClick={download} disabled={busy || !from || !to || from > to || tooLong} className="w-full gap-2">
            <Download className="h-4 w-4" aria-hidden /> {busy ? t("exportData.downloading") : t("exportData.download")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
