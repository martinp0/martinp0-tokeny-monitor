import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Info, Lock, PiggyBank, Settings2 } from "lucide-react";
import { Area, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UpgradeModal } from "@/components/UpgradeModal";
import { useSubscription } from "@/hooks/useSubscription";
import { useCurrency } from "@/hooks/useCurrency";
import { api } from "@/lib/api";
import { fmtCost } from "@/lib/format";
import { CHART_SERIES, chartTooltipStyle } from "@/lib/chart-theme";
import { providerLabel, type BudgetConfig, type BudgetStatus, type ScopeStatus } from "@/lib/budget";
import { cn } from "@/lib/utils";

/** Budget progress + month-end forecast. Pro only (the API enforces it); Free sees a teaser. */
export function BudgetForecastCard() {
  const { isPro, loading } = useSubscription();
  if (loading) return <Card className="h-[340px] animate-pulse" aria-hidden />;
  return isPro ? <BudgetForecastPro /> : <BudgetForecastTeaser />;
}

function useFmt() {
  const { currency, exchangeRate } = useCurrency();
  return (usd: number, d = 2) => fmtCost(usd, d, currency, exchangeRate);
}

function BudgetForecastPro() {
  const { t } = useTranslation();
  const [data, setData] = useState<{ budget: BudgetConfig | null; status: BudgetStatus } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    api<{ budget: BudgetConfig | null; status: BudgetStatus }>("/budget").then(setData).catch(() => setFailed(true));
  }, []);
  if (failed) return <Card><CardContent className="p-6 text-sm text-muted-foreground">{t("budget.loadError")}</CardContent></Card>;
  if (!data) return <Card className="h-[340px] animate-pulse" aria-hidden />;
  return <BudgetForecastView status={data.status} hasBudget={!!data.budget} />;
}

export function BudgetForecastView({ status, hasBudget }: { status: BudgetStatus; hasBudget: boolean }) {
  const { t } = useTranslation();
  const fmt = useFmt();
  const { total } = status;
  const f = total.forecast;
  const budget = total.budget_usd;
  const chart = useMemo(() => buildChart(status), [status]);
  const withBudget = status.providers.filter((p) => p.has_budget);

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <PiggyBank className="h-4 w-4 text-primary" aria-hidden /> {t("budget.title")}
        </CardTitle>
        <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground">
          <Link to="/settings#budget"><Settings2 className="h-3.5 w-3.5" aria-hidden />{hasBudget ? t("budget.edit") : t("budget.setBudget")}</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[13px] text-muted-foreground">{t("budget.spent")}</p>
            <p className="text-2xl font-semibold tabular-nums tracking-tight">{fmt(f.spent_usd)}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{budget ? t("budget.of", { budget: fmt(budget, 0) }) : t("budget.noBudget")}</p>
          </div>
          <div>
            <p className="text-[13px] text-muted-foreground flex items-center gap-1">
              {t("budget.forecast")}
              <MethodTip status={total} />
            </p>
            <p className="text-2xl font-semibold tabular-nums tracking-tight text-primary">{f.forecast_usd == null ? "—" : fmt(f.forecast_usd)}</p>
            {f.forecast_usd != null && (
              <p className="text-xs text-muted-foreground tabular-nums">{t("budget.range", { low: fmt(f.low_usd ?? 0, 0), high: fmt(f.high_usd ?? 0, 0) })}</p>
            )}
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ConfidenceDot c={f.confidence} /> {t(`budget.confidence.${f.confidence}`)}
            </p>
          </div>
        </div>

        {budget ? <ProgressBar status={total} /> : null}
        <Verdict status={total} />

        <div className="h-[150px]" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chart} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => fmt(Number(v), 0)} width={56} />
              <ChartTooltip {...chartTooltipStyle} formatter={(v: unknown) => (Array.isArray(v) ? `${fmt(Number(v[0]))} – ${fmt(Number(v[1]))}` : fmt(Number(v)))} />
              <Area dataKey="range" stroke="none" fill={CHART_SERIES[1]} fillOpacity={0.12} isAnimationActive={false} />
              <Line dataKey="actual" name={t("budget.legendActual")} stroke={CHART_SERIES[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line dataKey="projected" name={t("budget.legendForecast")} stroke={CHART_SERIES[1]} strokeWidth={2} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
              {budget ? <ReferenceLine y={budget} stroke="hsl(var(--destructive))" strokeDasharray="3 3" strokeOpacity={0.6} /> : null}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {withBudget.length > 0 && (
          <div className="space-y-2">
            <p className="text-[13px] font-medium text-muted-foreground">{t("budget.providers")}</p>
            {withBudget.map((p) => (
              <div key={p.scope} className="space-y-1">
                <div className="flex justify-between text-xs tabular-nums">
                  <span>{providerLabel(p.scope)}</span>
                  <span className="text-muted-foreground">{fmt(p.forecast.spent_usd)} / {fmt(p.budget_usd ?? 0, 0)}</span>
                </div>
                <ProgressBar status={p} thin />
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground tabular-nums">{t("budget.day", { day: f.day_of_month, days: f.days_in_month })}</p>
      </CardContent>
    </Card>
  );
}

function buildChart(s: BudgetStatus) {
  const f = s.total.forecast;
  const byDay = Object.fromEntries(s.days.map((d) => [Number(d.date.slice(8, 10)), d.cost_usd]));
  const rows: Array<{ day: number; actual?: number; projected?: number; range?: [number, number] }> = [];
  let cum = 0;
  const R = f.days_remaining;
  for (let d = 1; d <= f.days_in_month; d++) {
    if (d <= f.day_of_month) {
      cum += byDay[d] ?? 0;
      rows.push({ day: d, actual: cum });
    } else rows.push({ day: d });
  }
  if (f.forecast_usd != null && f.low_usd != null && f.high_usd != null && R > 0) {
    for (const r of rows) {
      if (r.day < f.day_of_month) continue;
      const k = r.day === f.day_of_month ? 0 : Math.min(1, (r.day - f.day_of_month + (R - Math.floor(R))) / R);
      r.projected = f.spent_usd + (f.forecast_usd - f.spent_usd) * k;
      r.range = [f.spent_usd + (f.low_usd - f.spent_usd) * k, f.spent_usd + (f.high_usd - f.spent_usd) * k];
    }
  }
  return rows;
}

function ProgressBar({ status, thin }: { status: ScopeStatus; thin?: boolean }) {
  const b = status.budget_usd ?? 0;
  const f = status.forecast;
  const pct = b > 0 ? (f.spent_usd / b) * 100 : 0;
  const fpct = b > 0 && f.forecast_usd != null ? (f.forecast_usd / b) * 100 : 0;
  const tone = pct >= 100 ? "bg-destructive" : pct >= 80 || fpct > 100 ? "bg-warning" : "bg-primary";
  return (
    <div
      className={cn("relative w-full rounded-full bg-secondary overflow-hidden", thin ? "h-1.5" : "h-2.5")}
      role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(pct, 100))}
    >
      {fpct > pct && <div className="absolute inset-y-0 left-0 bg-primary/20" style={{ width: `${Math.min(fpct, 100)}%` }} />}
      <div className={cn("absolute inset-y-0 left-0 rounded-full transition-all", tone)} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

function Verdict({ status }: { status: ScopeStatus }) {
  const { t } = useTranslation();
  const fmt = useFmt();
  const b = status.budget_usd;
  const f = status.forecast;
  if (!b) return null;
  if (f.spent_usd > b) return <p className="text-sm text-destructive">{t("budget.overNow", { amount: fmt(f.spent_usd - b, 0) })}</p>;
  if (f.forecast_usd == null) return <p className="text-sm text-muted-foreground">{t("budget.noForecast")}</p>;
  return f.forecast_usd > b
    ? <p className="text-sm text-warning">{t("budget.over", { amount: fmt(f.forecast_usd - b, 0) })}</p>
    : <p className="text-sm text-muted-foreground">{t("budget.under", { amount: fmt(b - f.forecast_usd, 0) })}</p>;
}

function ConfidenceDot({ c }: { c: string }) {
  const color = c === "high" ? "bg-success" : c === "medium" ? "bg-warning" : "bg-muted-foreground";
  return <span className={cn("inline-block h-1.5 w-1.5 rounded-full align-middle", color)} aria-hidden />;
}

function MethodTip({ status }: { status: ScopeStatus }) {
  const { t } = useTranslation();
  const f = status.forecast;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={t("budget.methodTitle")}>
          <Info className="h-3.5 w-3.5" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs leading-relaxed">
        <p className="font-medium mb-1">{t("budget.methodTitle")}</p>
        {f.days_observed > 0
          ? t("budget.method", { n: f.days_observed, remaining: f.days_remaining.toFixed(1) })
          : t("budget.methodNone")}
      </TooltipContent>
    </Tooltip>
  );
}

/** Free: a calm, blurred sample behind a Liquid Glass lock panel. Nothing is fetched. */
function BudgetForecastTeaser() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none select-none blur-[6px] opacity-70" aria-hidden>
        <BudgetForecastView status={SAMPLE} hasBudget />
      </div>
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="glass-panel rounded-3xl px-6 py-5 max-w-sm text-center space-y-3">
          <div className="mx-auto h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <p className="text-[15px] font-semibold">{t("budget.teaserTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("budget.teaserDesc")}</p>
          <Button size="sm" onClick={() => setOpen(true)}>{t("budget.teaserCta")}</Button>
        </div>
      </div>
      <UpgradeModal open={open} onOpenChange={setOpen} feature="forecast" />
    </Card>
  );
}

const SAMPLE: BudgetStatus = (() => {
  const days = Array.from({ length: 18 }, (_, i) => ({ date: `2026-01-${String(i + 1).padStart(2, "0")}`, cost_usd: 1.6 + ((i * 7) % 5) * 0.35 }));
  const spent = days.reduce((s, d) => s + d.cost_usd, 0);
  const forecast = {
    period: "2026-01", spent_usd: spent, forecast_usd: spent + 2.3 * 13.5, low_usd: spent + 1.7 * 13.5, high_usd: spent + 2.9 * 13.5,
    daily_rate_usd: 2.3, confidence: "high" as const, days_observed: 17, day_of_month: 18, days_in_month: 31, days_remaining: 13.5, method: "weighted_run_rate" as const,
  };
  return { period: "2026-01", usd_czk: 23.5, total: { scope: "total", budget_usd: 60, forecast }, providers: [], days };
})();
