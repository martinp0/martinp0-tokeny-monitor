import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bell, TrendingUp, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSubscription } from "@/hooks/useSubscription";
import { useCurrency } from "@/hooks/useCurrency";
import { api } from "@/lib/api";
import { fmtCost } from "@/lib/format";
import { ALERTS_CHANGED, providerLabel, type BudgetAlertEvent } from "@/lib/budget";
import { cn } from "@/lib/utils";

/** In-app alert center (bell + unread badge). Pro only; alerts are written by the daily cron. */
export function AlertCenter() {
  const { isPro, loading } = useSubscription();
  if (loading || !isPro) return null;
  return <AlertCenterPro />;
}

function AlertCenterPro() {
  const { t, i18n } = useTranslation();
  const { currency, exchangeRate } = useCurrency();
  const fmt = (usd: number) => fmtCost(usd, 0, currency, exchangeRate);
  const [alerts, setAlerts] = useState<BudgetAlertEvent[]>([]);
  const [unread, setUnread] = useState(0);
  const load = useCallback(() => {
    api<{ alerts: BudgetAlertEvent[]; unread: number }>("/alerts")
      .then((r) => { setAlerts(r.alerts); setUnread(r.unread); })
      .catch(() => { /* badge is optional; stay quiet */ });
  }, []);
  useEffect(() => {
    load();
    window.addEventListener(ALERTS_CHANGED, load);
    return () => window.removeEventListener(ALERTS_CHANGED, load);
  }, [load]);

  async function markAll() {
    await api("/alerts/read", { body: {} }).catch(() => null);
    window.dispatchEvent(new Event(ALERTS_CHANGED));
  }
  const scope = (s: string) => (s === "total" ? t("alerts.total") : providerLabel(s));
  const text = (a: BudgetAlertEvent) =>
    a.kind === "forecast"
      ? t("alerts.forecast", { scope: scope(a.scope), forecast: fmt(a.forecast_usd ?? 0), budget: fmt(a.budget_usd) })
      : t("alerts.threshold", { scope: scope(a.scope), pct: a.threshold_pct, spent: fmt(a.spent_usd), budget: fmt(a.budget_usd) });
  const locale = i18n.language?.startsWith("en") ? "en-GB" : "cs-CZ";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label={t("alerts.open", { count: unread })}>
          <Bell className="h-4 w-4" aria-hidden />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[11px] font-semibold leading-[18px] tabular-nums text-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="glass-panel w-80 p-0 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <p className="text-sm font-semibold">{t("alerts.title")}</p>
          {unread > 0 && <button type="button" onClick={markAll} className="text-xs text-primary hover:underline">{t("alerts.markAll")}</button>}
        </div>
        <ul className="max-h-80 overflow-y-auto">
          {alerts.length === 0 && <li className="px-4 py-6 text-sm text-muted-foreground text-center">{t("alerts.empty")}</li>}
          {alerts.map((a) => {
            const Icon = a.kind === "forecast" ? TrendingUp : Gauge;
            const strong = a.kind === "threshold" && a.threshold_pct >= 100;
            return (
              <li key={a.id} className={cn("flex gap-3 px-4 py-3 border-b border-border/40 last:border-0", !a.read_at && "bg-primary/5")}>
                <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", strong ? "text-destructive" : a.kind === "forecast" ? "text-warning" : "text-primary")} aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm leading-snug">{text(a)}</p>
                  <p className="text-xs text-muted-foreground tabular-nums mt-0.5">{new Date(a.created_at).toLocaleDateString(locale)}</p>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="px-4 py-2 text-[11px] text-muted-foreground border-t border-border/60">{t("alerts.note")}</p>
      </PopoverContent>
    </Popover>
  );
}
