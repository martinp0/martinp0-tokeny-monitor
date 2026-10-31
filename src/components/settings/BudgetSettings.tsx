import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProGate } from "@/components/ProGate";
import { useSubscription } from "@/hooks/useSubscription";
import { useCurrency } from "@/hooks/useCurrency";
import { api } from "@/lib/api";
import { providerLabel, THRESHOLD_CHOICES, type BudgetConfig, type BudgetCurrency, type BudgetStatus } from "@/lib/budget";
import { cn } from "@/lib/utils";

/** Budget, thresholds and per-provider budgets (Pro; the API enforces it). */
export function BudgetSettings() {
  const { t } = useTranslation();
  return (
    <Card id="budget" className="glass border-border scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4 text-primary" aria-hidden /> {t("budget.settings.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ProGate feature="budget_alerts"><BudgetForm /></ProGate>
      </CardContent>
    </Card>
  );
}

function BudgetForm() {
  const { t } = useTranslation();
  const { isPro } = useSubscription();
  const { currency: displayCurrency } = useCurrency();
  const [cfg, setCfg] = useState<BudgetConfig | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<BudgetCurrency>(displayCurrency);
  const [thresholds, setThresholds] = useState<number[]>([50, 80, 100]);
  const [forecastAlert, setForecastAlert] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [perProvider, setPerProvider] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const amountId = useId();

  useEffect(() => {
    if (!isPro) return;
    api<{ budget: BudgetConfig | null; status: BudgetStatus }>("/budget")
      .then(({ budget, status }) => {
        setSources(status.providers.map((p) => p.scope));
        if (!budget) return;
        setCfg(budget);
        setAmount(String(budget.budget_amount));
        setCurrency(budget.budget_currency);
        setThresholds(budget.thresholds);
        setForecastAlert(budget.forecast_alert);
        setEnabled(budget.enabled);
        setPerProvider(Object.fromEntries(Object.entries(budget.provider_budgets).map(([k, v]) => [k, String(v)])));
      })
      .catch((e: Error) => toast.error(e.message));
  }, [isPro]);

  const toggle = (v: number) =>
    setThresholds((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : cur.length >= 6 ? cur : [...cur, v].sort((a, b) => a - b)));

  async function save() {
    const n = Number(amount.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return toast.error(t("budget.settings.invalid"));
    const pb: Record<string, number> = {};
    for (const [k, v] of Object.entries(perProvider)) {
      const x = Number(v.replace(",", "."));
      if (v.trim() && Number.isFinite(x) && x > 0) pb[k] = x;
    }
    setSaving(true);
    try {
      const r = await api<{ alert: BudgetConfig }>("/budget-alert", {
        method: "PUT",
        body: { budget_amount: n, budget_currency: currency, thresholds, forecast_alert: forecastAlert, provider_budgets: pb, enabled },
      });
      setCfg(r.alert);
      toast.success(t("budget.settings.saved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    await api("/budget-alert", { method: "DELETE" }).catch(() => null);
    setCfg(null);
    setAmount("");
    toast.success(t("budget.settings.removed"));
  }

  const providerRows = [...new Set([...sources, ...Object.keys(perProvider)])];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[1fr_auto] gap-3 items-end max-w-md">
        <div>
          <Label htmlFor={amountId} className="text-xs">{t("budget.settings.amount")}</Label>
          <Input id={amountId} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={currency === "CZK" ? "1000" : "50"} className="mt-1 tabular-nums" />
        </div>
        <div>
          <Label className="text-xs">{t("budget.settings.currency")}</Label>
          <Select value={currency} onValueChange={(v) => setCurrency(v as BudgetCurrency)}>
            <SelectTrigger className="mt-1 w-24" aria-label={t("budget.settings.currency")}><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="CZK">Kč</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium mb-1.5">{t("budget.settings.thresholds")}</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("budget.settings.thresholds")}>
          {THRESHOLD_CHOICES.map((v) => (
            <button
              key={v} type="button" aria-pressed={thresholds.includes(v)} onClick={() => toggle(v)}
              className={cn("h-8 px-3 rounded-full text-sm tabular-nums border transition-colors",
                thresholds.includes(v) ? "bg-primary text-primary-foreground border-primary" : "bg-secondary/40 border-border hover:bg-secondary")}
            >
              {v} %
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">{t("budget.settings.thresholdsHint")}</p>
      </div>

      <label className="flex items-center gap-3 text-sm">
        <Switch checked={forecastAlert} onCheckedChange={setForecastAlert} /> {t("budget.settings.forecastAlert")}
      </label>

      {providerRows.length > 0 && (
        <div>
          <p className="text-xs font-medium mb-1.5">{t("budget.settings.providerBudgets")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {providerRows.map((p) => (
              <label key={p} className="flex items-center gap-2 text-sm">
                <span className="w-28 shrink-0 truncate">{providerLabel(p)}</span>
                <Input inputMode="decimal" value={perProvider[p] ?? ""} onChange={(e) => setPerProvider((o) => ({ ...o, [p]: e.target.value }))}
                  className="h-8 tabular-nums" aria-label={`${providerLabel(p)} (${currency})`} placeholder={currency === "CZK" ? "Kč" : "USD"} />
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">{t("budget.settings.providerHint")}</p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{t("budget.settings.inApp")}</p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={enabled} onCheckedChange={setEnabled} /> {t("budget.settings.enabled")}
        </label>
        <div className="flex gap-2">
          {cfg && <Button variant="outline" onClick={remove}>{t("budget.settings.remove")}</Button>}
          <Button onClick={save} disabled={saving}>{t("budget.settings.save")}</Button>
        </div>
      </div>
    </div>
  );
}
