import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Clock, Eye, Link2Off, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CHART_AXIS, CHART_FONT, CHART_GRID, CHART_SERIES, chartTooltipStyle } from "@/lib/chart-theme";
import { fmtCost, fmtCostShort, fmtNum, fmtNumShort } from "@/lib/format";
import { providerLabel } from "@/lib/budget";
import type { SharedMetric, SharedPayload } from "@/lib/share";

type State =
  | { kind: "loading" }
  | { kind: "ok"; data: SharedPayload }
  | { kind: "error"; status: number; reason: string };

/** Public, read-only view of a share link (/s/:token). Only aggregates; never account data. */
export default function SharedDashboard() {
  const { token } = useParams<{ token: string }>();
  const { t, i18n } = useTranslation();
  const [state, setState] = useState<State>({ kind: "loading" });
  const en = i18n.language?.startsWith("en");
  const numCur = en ? "USD" : "CZK"; // only picks the number locale

  useEffect(() => {
    if (!token) return;
    const ctl = new AbortController();
    fetch(`/api/shared/${encodeURIComponent(token)}`, { signal: ctl.signal, credentials: "omit", cache: "no-store" })
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (r.ok && body) setState({ kind: "ok", data: body as SharedPayload });
        else setState({ kind: "error", status: r.status, reason: String(body?.error ?? "") });
      })
      .catch((e) => { if (e?.name !== "AbortError") setState({ kind: "error", status: 0, reason: "network" }); });
    return () => ctl.abort();
  }, [token]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>{state.kind === "ok" ? `${state.data.label || t("share.untitled")} – Tokeny` : "Tokeny"}</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Helmet>
      <header className="glass-bar sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="h-7 w-7 rounded-xl bg-primary/15 grid place-items-center"><Activity className="h-4 w-4 text-primary" aria-hidden /></span>
            Tokeny
          </Link>
          <div className="flex items-center gap-2">
            <span className="glass-pill px-3 h-7 inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Eye className="h-3.5 w-3.5" aria-hidden />{t("shared.readOnly")}</span>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
        {state.kind === "loading" && <p className="text-sm text-muted-foreground py-20 text-center">{t("shared.loading")}</p>}
        {state.kind === "error" && <SharedError status={state.status} reason={state.reason} />}
        {state.kind === "ok" && <SharedView data={state.data} numCur={numCur} />}
      </main>
    </div>
  );
}

function SharedError({ status, reason }: { status: number; reason: string }) {
  const { t } = useTranslation();
  const gone = status === 410;
  const rate = status === 429;
  const title = rate ? t("shared.rateTitle") : gone ? t("shared.goneTitle") : t("shared.notFoundTitle");
  const desc = rate ? t("shared.rateDesc")
    : gone ? t(reason === "expired" ? "shared.expiredDesc" : reason === "inactive" ? "shared.inactiveDesc" : "shared.revokedDesc")
    : t("shared.notFoundDesc");
  const Icon = rate ? Clock : Link2Off;
  return (
    <div className="glass-panel rounded-3xl max-w-md mx-auto mt-10 p-8 text-center space-y-3">
      <div className="mx-auto h-12 w-12 rounded-2xl bg-secondary grid place-items-center"><Icon className="h-6 w-6 text-muted-foreground" aria-hidden /></div>
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{desc}</p>
      <p className="text-xs text-muted-foreground tabular-nums">{status ? `HTTP ${status}` : ""}</p>
      <Button asChild variant="outline"><Link to="/">{t("shared.home")}</Link></Button>
    </div>
  );
}

function SharedView({ data, numCur }: { data: SharedPayload; numCur: "USD" | "CZK" }) {
  const { t, i18n } = useTranslation();
  const amounts = data.show_amounts && data.totals.cost_usd !== undefined;
  const cur = data.currency;
  const rate = data.usd_czk ?? 0;
  const locale = i18n.language?.startsWith("en") ? "en-GB" : "cs-CZ";
  const day = (s: string) => new Date(`${s}T12:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "numeric", year: "numeric" });
  const tokens = data.totals.input_tokens + data.totals.output_tokens;
  const live = data.period.type !== "range";

  const chart = useMemo(
    () => data.daily.map((d) => ({ date: d.date.slice(5).split("-").reverse().join("."), value: amounts ? d.cost_usd ?? 0 : d.tokens })),
    [data.daily, amounts],
  );
  const metricLabel = amounts ? t("shared.cost") : t("shared.tokens");
  const fmtValue = (v: number) => (amounts ? fmtCost(v, 2, cur, rate) : fmtNum(v, numCur));
  const fmtShort = (v: number) => (amounts ? fmtCostShort(v, cur, rate) : fmtNumShort(v, numCur));

  return (
    <div className="space-y-5">
      <section className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{data.label || t("share.untitled")}</h1>
        <p className="text-sm text-muted-foreground tabular-nums">
          {t("shared.period", { from: day(data.period.from), to: day(data.period.to) })}
          {live && <> · {t("shared.periodLive")}</>}
          {data.providers_filter.length > 0 && <> · {data.providers_filter.map(providerLabel).join(", ")}</>}
        </p>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label={t("shared.cost")} value={amounts ? fmtCost(data.totals.cost_usd ?? 0, 2, cur, rate) : "—"} hint={amounts ? undefined : t("share.percentOnly")} />
        <Kpi label={t("shared.requests")} value={fmtNum(data.totals.requests, numCur)} />
        <Kpi label={t("shared.tokens")} value={fmtNumShort(tokens, numCur)} />
        <Kpi label={t("shared.providers")} value={String(data.providers.length)} />
      </section>

      {!amounts && <p className="glass-panel rounded-2xl px-4 py-3 text-sm text-muted-foreground flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-primary" aria-hidden />{t("shared.hiddenAmounts")}</p>}

      <section className="glass-panel rounded-3xl p-4 sm:p-5">
        <h2 className="text-[15px] font-semibold tracking-tight mb-3">{t("shared.daily")} · {metricLabel}</h2>
        {data.daily.every((d) => d.tokens === 0 && d.requests === 0) ? (
          <p className="text-sm text-muted-foreground py-10 text-center">{t("shared.empty")}</p>
        ) : (
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart}>
                <defs>
                  <linearGradient id="sharedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_SERIES[0]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_SERIES[0]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={CHART_GRID} />
                <XAxis dataKey="date" stroke={CHART_AXIS} tickLine={false} axisLine={false} fontSize={11} fontFamily={CHART_FONT} minTickGap={16} />
                <YAxis stroke={CHART_AXIS} tickLine={false} axisLine={false} fontSize={11} fontFamily={CHART_FONT} width={56} tickFormatter={fmtShort} />
                <Tooltip {...chartTooltipStyle} formatter={(v: number) => [fmtValue(v), metricLabel]} />
                <Area type="monotone" dataKey="value" stroke={CHART_SERIES[0]} fill="url(#sharedGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="grid md:grid-cols-2 gap-3">
        <Breakdown title={t("shared.providers")} rows={data.providers.map((p) => ({ name: providerLabel(p.provider), ...p }))} amounts={amounts} cur={cur} rate={rate} numCur={numCur} />
        <Breakdown title={t("shared.models")} rows={data.models.map((m) => ({ name: m.model, sub: providerLabel(m.provider), ...m }))} amounts={amounts} cur={cur} rate={rate} numCur={numCur} />
      </section>

      <footer className="text-xs text-muted-foreground space-y-1 text-center pt-2">
        {amounts && cur === "CZK" && <p>{t("shared.rateNote", { rate: rate.toFixed(3).replace(".", i18n.language?.startsWith("en") ? "." : ","), date: data.rate_date ? day(data.rate_date) : "—" })}</p>}
        <p>{t("shared.footer")}</p>
        <p><Link to="/" className="text-primary hover:underline">{t("shared.cta")}</Link></p>
      </footer>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="glass-panel rounded-3xl p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl sm:text-2xl font-semibold tracking-tight tabular-nums mt-1">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Breakdown({ title, rows, amounts, cur, rate, numCur }: {
  title: string; rows: Array<SharedMetric & { name: string; sub?: string }>; amounts: boolean; cur: "USD" | "CZK"; rate: number; numCur: "USD" | "CZK";
}) {
  const { t } = useTranslation();
  return (
    <div className="glass-panel rounded-3xl p-4 sm:p-5">
      <h2 className="text-[15px] font-semibold tracking-tight mb-3">{title}</h2>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("shared.empty")}</p> : (
        <ul className="space-y-2.5">
          {rows.map((r, i) => (
            <li key={`${r.name}-${i}`} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate">{r.name}{r.sub && <span className="text-xs text-muted-foreground"> · {r.sub}</span>}</span>
                <span className="tabular-nums shrink-0 text-muted-foreground">
                  {amounts && r.cost_usd !== undefined ? <span className="text-foreground font-medium">{fmtCost(r.cost_usd, 2, cur, rate)} · </span> : null}
                  {r.cost_pct.toLocaleString(numCur === "CZK" ? "cs-CZ" : "en-GB", { maximumFractionDigits: 1 })} %
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden" role="presentation">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, r.cost_pct)}%`, background: CHART_SERIES[i % CHART_SERIES.length] }} />
              </div>
              <p className="text-[11px] text-muted-foreground tabular-nums">{fmtNumShort(r.tokens, numCur)} {t("shared.tokens").toLowerCase()} · {fmtNum(r.requests, numCur)} {t("shared.requests").toLowerCase()}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
