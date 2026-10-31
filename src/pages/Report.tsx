import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProGate } from "@/components/ProGate";
import { useCurrency } from "@/hooks/useCurrency";
import { useSubscription } from "@/hooks/useSubscription";
import { api } from "@/lib/api";
import { providerLabel } from "@/lib/budget";
import { fmtCost, fmtNum, fmtNumShort } from "@/lib/format";
import { pragueToday, type MonthlyReport, type ReportRow } from "@/lib/share";

/** Printable monthly cost report (Pro). "Save as PDF" is the browser's print dialog. */
export default function Report() {
  const { t } = useTranslation();
  const { isPro, loading } = useSubscription();
  return (
    <div className="min-h-screen bg-background text-foreground report-page">
      <Helmet>
        <title>{t("report.title")} – Tokeny</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="max-w-4xl mx-auto px-4 py-6 print:p-0 print:max-w-none">
        <div className="flex items-center justify-between gap-3 mb-5 print:hidden">
          <Button asChild variant="ghost" size="sm" className="gap-1.5"><Link to="/dashboard"><ArrowLeft className="h-4 w-4" aria-hidden /> {t("report.back")}</Link></Button>
        </div>
        {!loading && !isPro && <p className="text-sm text-muted-foreground text-center max-w-md mx-auto mb-4">{t("exportData.teaserDesc")}</p>}
        <ProGate feature="exports"><ReportBody /></ProGate>
      </div>
    </div>
  );
}

function ReportBody() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.get("month") ?? "") ? params.get("month")! : pragueToday().slice(0, 7);
  const [data, setData] = useState<MonthlyReport | null>(null);
  const { currency } = useCurrency();
  const en = i18n.language?.startsWith("en");
  const locale = en ? "en-GB" : "cs-CZ";
  const numCur = en ? "USD" : "CZK";

  useEffect(() => {
    setData(null);
    api<MonthlyReport>(`/report?month=${month}`).then(setData).catch((e) => toast.error(e instanceof Error ? e.message : String(e)));
  }, [month]);

  const rate = data?.usd_czk ?? 0;
  const money = (usd: number, d = 2) => fmtCost(usd, d, currency, rate);
  const monthName = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString(locale, { month: "long", year: "numeric" });
  const day = (s: string) => new Date(`${s}T12:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "numeric" });
  const delta = data && data.previous.cost_usd > 0 ? (data.totals.cost_usd - data.previous.cost_usd) / data.previous.cost_usd : null;
  const pct = (v: number) => (data && data.totals.cost_usd > 0 ? `${((v / data.totals.cost_usd) * 100).toLocaleString(locale, { maximumFractionDigits: 1 })} %` : "—");

  return (
    <article className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Tokeny</p>
          <h1 className="text-2xl font-semibold tracking-tight">{t("report.title")}</h1>
          <p className="text-lg text-muted-foreground capitalize">{monthName(month)}</p>
        </div>
        <div className="flex items-end gap-2 print:hidden">
          <div className="space-y-1">
            <Label htmlFor="report-month" className="text-xs">{t("report.month")}</Label>
            <Input id="report-month" type="month" value={month} max={pragueToday().slice(0, 7)} onChange={(e) => e.target.value && setParams({ month: e.target.value })} className="w-44" />
          </div>
          <Button onClick={() => window.print()} className="gap-2" disabled={!data}><Printer className="h-4 w-4" aria-hidden /> {t("report.print")}</Button>
        </div>
      </header>
      <p className="text-xs text-muted-foreground print:hidden">{t("report.printHint")}</p>

      {!data ? <p className="text-sm text-muted-foreground py-10 text-center">{t("shared.loading")}</p> : (
        <>
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label={t("report.total")} value={money(data.totals.cost_usd)} />
            <Stat label={t("report.requests")} value={fmtNum(data.totals.requests, numCur)} />
            <Stat label={t("report.tokens")} value={fmtNumShort(data.totals.input_tokens + data.totals.output_tokens, numCur)} />
            <Stat label={t("report.prev")} value={money(data.previous.cost_usd)}
              hint={delta === null ? monthName(data.previous.month) : t("report.vsPrev", { pct: `${delta >= 0 ? "+" : ""}${(delta * 100).toLocaleString(locale, { maximumFractionDigits: 0 })} %`, month: monthName(data.previous.month) })} />
          </section>
          {data.budget && (() => {
            const b = data.budget.currency === "CZK" ? data.budget.amount / (rate || 1) : data.budget.amount;
            const used = b > 0 ? `${((data.totals.cost_usd / b) * 100).toLocaleString(locale, { maximumFractionDigits: 0 })} %` : "—";
            return (
              <p className="text-sm">{t("report.budget")}: <strong className="tabular-nums">{data.budget.currency === "CZK" ? `${fmtNum(data.budget.amount, "CZK")} Kč` : `$${data.budget.amount}`}</strong>
                {" · "}<span className="tabular-nums">{used}</span></p>
            );
          })()}
          {data.totals.requests === 0 ? <p className="text-sm text-muted-foreground py-6">{t("report.empty")}</p> : (
            <>
              <Table title={t("report.byProvider")} first={t("report.provider")} rows={data.providers} name={(r) => providerLabel(r.provider ?? "")} money={money} pct={pct} numCur={numCur} />
              <Table title={t("report.byModel")} first={t("report.model")} rows={data.models} name={(r) => `${r.model}${r.provider ? ` · ${providerLabel(r.provider)}` : ""}`} money={money} pct={pct} numCur={numCur} />
              <Table title={t("report.byDay")} first={t("report.date")} rows={data.daily} name={(r) => day(r.day ?? "")} money={money} pct={pct} numCur={numCur} />
            </>
          )}
          <footer className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
            <p>{t("report.generated", { date: new Date(data.generated_at).toLocaleString(locale, { timeZone: "Europe/Prague" }) })}</p>
            <p>{currency === "CZK" ? t("exportData.noteCzk", { rate: rate.toLocaleString(locale, { maximumFractionDigits: 3 }) }) : t("exportData.noteUsd")}</p>
          </footer>
        </>
      )}
    </article>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="glass rounded-2xl p-3 print:border print:border-neutral-300">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Table({ title, first, rows, name, money, pct, numCur }: {
  title: string; first: string; rows: ReportRow[]; name: (r: ReportRow) => string; money: (n: number, d?: number) => string; pct: (n: number) => string; numCur: "USD" | "CZK";
}) {
  const { t } = useTranslation();
  return (
    <section className="break-inside-avoid-page">
      <h2 className="text-[15px] font-semibold tracking-tight mb-2">{title}</h2>
      <table className="w-full text-sm tabular-nums">
        <thead className="text-xs text-muted-foreground text-left border-b border-border">
          <tr><th className="py-1.5 font-medium">{first}</th><th className="py-1.5 font-medium text-right">{t("report.requests")}</th><th className="py-1.5 font-medium text-right">{t("report.tokens")}</th><th className="py-1.5 font-medium text-right">{t("report.cost")}</th><th className="py-1.5 font-medium text-right">{t("report.share")}</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/50 break-inside-avoid">
              <td className="py-1.5 pr-2 max-w-[18rem] truncate">{name(r)}</td>
              <td className="py-1.5 text-right">{fmtNum(r.requests, numCur)}</td>
              <td className="py-1.5 text-right">{fmtNumShort(r.tokens, numCur)}</td>
              <td className="py-1.5 text-right">{money(r.cost_usd)}</td>
              <td className="py-1.5 text-right text-muted-foreground">{pct(r.cost_usd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
