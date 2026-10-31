import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ActivityRow } from "@/lib/csv-parser";
import { useCurrency } from "@/hooks/useCurrency";
import { fmtCost } from "@/lib/format";
import { TrendingUp } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import { CHART_SERIES, chartTooltipStyle } from "@/lib/chart-theme";

interface Props {
  data: ActivityRow[];
}

export function CostForecast({ data }: Props) {
  const { currency, exchangeRate } = useCurrency();

  const { chart, projected, monthSpent, daysInMonth, daysPassed } = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysPassed = now.getDate();

    const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const monthRows = data.filter((r) => r.created_at >= monthStart);

    const byDay: Record<string, number> = {};
    for (const r of monthRows) {
      const d = r.created_at.substring(0, 10);
      byDay[d] = (byDay[d] ?? 0) + r.cost_total;
    }

    let cum = 0;
    const chart: Array<{ day: number; actual?: number; projected?: number }> = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (d <= daysPassed) {
        cum += byDay[key] ?? 0;
        chart.push({ day: d, actual: cum });
      } else {
        chart.push({ day: d });
      }
    }
    const monthSpent = cum;
    const dailyAvg = daysPassed > 0 ? monthSpent / daysPassed : 0;
    const projected = dailyAvg * daysInMonth;

    // fill projection line from today onward
    let proj = monthSpent;
    for (let i = 0; i < chart.length; i++) {
      const c = chart[i];
      if (c.day === daysPassed) c.projected = monthSpent;
      else if (c.day > daysPassed) {
        proj += dailyAvg;
        c.projected = proj;
      }
    }

    return { chart, projected, monthSpent, daysInMonth, daysPassed };
  }, [data]);

  const fmt = (usd: number) => fmtCost(usd, 2, currency, exchangeRate);

  return (
    <Card className="glass border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Predikce nákladů – tento měsíc
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2 mb-3 text-center">
          <div>
            <div className="text-xs text-muted-foreground tabular-nums uppercase">Utraceno</div>
            <div className="text-sm tabular-nums font-semibold mt-1">{fmt(monthSpent)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground tabular-nums uppercase">Predikce konec</div>
            <div className="text-sm tabular-nums font-semibold mt-1 text-primary">{fmt(projected)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground tabular-nums uppercase">Den</div>
            <div className="text-sm tabular-nums font-semibold mt-1">{daysPassed}/{daysInMonth}</div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chart} margin={{ left: 0, right: 8, top: 5, bottom: 0 }}>
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => fmt(v)} width={60} />
            <Tooltip
              {...chartTooltipStyle}
              formatter={(v: number | string) => fmt(Number(v))}
            />
            <Line type="monotone" dataKey="actual" stroke={CHART_SERIES[0]} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="projected" stroke={CHART_SERIES[1]} strokeWidth={2} strokeDasharray="4 4" dot={false} />
            <ReferenceLine x={daysPassed} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
