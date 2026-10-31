import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, ExternalLink, Share2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrency } from "@/hooks/useCurrency";
import { api, ApiError } from "@/lib/api";
import { BUDGET_PROVIDER_LABELS } from "@/lib/budget";
import { pragueToday, shareUrl, type ShareLink, type SharePeriod } from "@/lib/share";
import { cn } from "@/lib/utils";

type PeriodChoice = "rolling7" | "rolling30" | "rolling90" | "rolling365" | "month" | "range";
type ExpiryChoice = "never" | "7" | "30" | "90";

/** Create a read-only share link (Pro; the API enforces it). The token is shown exactly once. */
export function ShareDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated?: (s: ShareLink) => void }) {
  const { t } = useTranslation();
  const { currency: displayCurrency } = useCurrency();
  const today = pragueToday();
  const [label, setLabel] = useState("");
  const [period, setPeriod] = useState<PeriodChoice>("rolling30");
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [providers, setProviders] = useState<string[]>([]);
  const [showAmounts, setShowAmounts] = useState(true);
  const [currency, setCurrency] = useState<"USD" | "CZK">(displayCurrency);
  const [expiry, setExpiry] = useState<ExpiryChoice>("30");
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const idLabel = useId(), idFrom = useId(), idTo = useId(), idAmounts = useId();

  function reset() {
    setUrl(null); setLabel(""); setPeriod("rolling30"); setProviders([]); setShowAmounts(true); setExpiry("30");
  }

  async function create() {
    const p: SharePeriod =
      period === "month" ? { type: "month" } : period === "range" ? { type: "range", from, to } : { type: "rolling", days: Number(period.slice(7)) as 7 | 30 | 90 | 365 };
    setBusy(true);
    try {
      const expires_at = expiry === "never" ? null : new Date(Date.now() + Number(expiry) * 86_400_000).toISOString();
      const r = await api<{ share: ShareLink; token: string }>("/shares", {
        body: { label: label.trim() || null, period: p, providers, show_amounts: showAmounts, currency, expires_at },
      });
      setUrl(shareUrl(r.token));
      onCreated?.(r.share);
    } catch (e) {
      const code = e instanceof ApiError ? String(e.body?.error ?? "") : "";
      toast.error(t(`share.errors.${code}`, { defaultValue: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(false);
    }
  }

  const toggleProvider = (p: string) => setProviders((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="glass-panel border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Share2 className="h-5 w-5 text-primary" aria-hidden /> {t("share.title")}</DialogTitle>
          <DialogDescription>{t("share.intro")}</DialogDescription>
        </DialogHeader>
        {!url ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={idLabel}>{t("share.label")}</Label>
              <Input id={idLabel} value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} placeholder={t("share.labelPlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("share.period")}</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as PeriodChoice)}>
                <SelectTrigger aria-label={t("share.period")}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["rolling7", "rolling30", "rolling90", "rolling365", "month", "range"] as const).map((k) => <SelectItem key={k} value={k}>{t(`share.${k}`)}</SelectItem>)}
                </SelectContent>
              </Select>
              {period === "range" && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="space-y-1"><Label htmlFor={idFrom} className="text-xs">{t("share.from")}</Label><Input id={idFrom} type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></div>
                  <div className="space-y-1"><Label htmlFor={idTo} className="text-xs">{t("share.to")}</Label><Input id={idTo} type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></div>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{t("share.providers")}</Label>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={providers.length === 0} onClick={() => setProviders([])}>{t("share.allProviders")}</Chip>
                {Object.entries(BUDGET_PROVIDER_LABELS).map(([k, v]) => <Chip key={k} active={providers.includes(k)} onClick={() => toggleProvider(k)}>{v}</Chip>)}
              </div>
            </div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <Label htmlFor={idAmounts}>{t("share.showAmounts")}</Label>
                <p className="text-xs text-muted-foreground">{t("share.showAmountsHint")}</p>
              </div>
              <Switch id={idAmounts} checked={showAmounts} onCheckedChange={setShowAmounts} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("share.currency")}</Label>
                <Select value={currency} onValueChange={(v) => setCurrency(v as "USD" | "CZK")} disabled={!showAmounts}>
                  <SelectTrigger aria-label={t("share.currency")}><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="CZK">Kč</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("share.expiry")}</Label>
                <Select value={expiry} onValueChange={(v) => setExpiry(v as ExpiryChoice)}>
                  <SelectTrigger aria-label={t("share.expiry")}><SelectValue /></SelectTrigger>
                  <SelectContent>{(["7", "30", "90", "never"] as const).map((k) => <SelectItem key={k} value={k}>{t(k === "never" ? "share.expiryNever" : `share.expiry${k}`)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground flex gap-1.5"><ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" aria-hidden />{t("share.warning")}</p>
            <Button onClick={create} disabled={busy || (period === "range" && (!from || !to || from > to))} className="w-full gap-2">
              <Share2 className="h-4 w-4" aria-hidden /> {busy ? t("share.creating") : t("share.create")}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 space-y-2">
              <p className="text-sm font-semibold text-primary">{t("share.created")}</p>
              <code className="block text-xs font-mono break-all select-all">{url}</code>
            </div>
            <p className="text-xs text-muted-foreground">{t("share.onlyOnce")}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => { void navigator.clipboard?.writeText(url); toast.success(t("share.copied")); }} className="gap-2"><Copy className="h-4 w-4" aria-hidden /> {t("share.copy")}</Button>
              <Button variant="outline" asChild className="gap-2"><a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" aria-hidden /> {t("share.open")}</a></Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cn("px-3 h-8 rounded-full text-xs border transition-colors", active ? "bg-primary text-primary-foreground border-primary" : "bg-secondary/60 border-border hover:bg-secondary")}>
      {children}
    </button>
  );
}
