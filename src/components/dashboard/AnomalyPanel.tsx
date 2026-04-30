import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ActivityRow } from "@/lib/csv-parser";
import { useCurrency } from "@/hooks/useCurrency";
import { fmtCost } from "@/lib/format";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

interface Props {
  data: ActivityRow[];
}

export function AnomalyPanel({ data }: Props) {
  const { currency, exchangeRate } = useCurrency();

  const { anomalies, mean, std } = useMemo(() => {
    const byDay: Record<string, number> = {};
    for (const r of data) {
      const d = r.created_at.substring(0, 10);
      byDay[d] = (byDay[d] ?? 0) + r.cost_total;
    }
    const values = Object.values(byDay);
    if (values.length === 0) return { anomalies: [], mean: 0, std: 0 };
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
    const anomalies = Object.entries(byDay)
      .filter(([, v]) => v > mean + 2 * std && std > 0)
      .map(([day, cost]) => ({ day, cost, ratio: cost / mean }))
      .sort((a, b) => b.cost - a.cost);
    return { anomalies, mean, std };
  }, [data]);

  const fmt = (usd: number) => fmtCost(usd, 2, currency, exchangeRate);

  return (
    <Card className="glass border-white/[0.06]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Detekce anomálií
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-[11px] text-muted-foreground font-mono mb-3">
          Průměr/den: {fmt(mean)} · σ: {fmt(std)}
        </div>
        {anomalies.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <CheckCircle2 className="h-4 w-4 text-accent" />
            Žádné anomálie – výdaje jsou stabilní.
          </div>
        ) : (
          <div className="space-y-1.5">
            {anomalies.slice(0, 5).map((a) => (
              <div key={a.day} className="flex items-center justify-between rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                <div>
                  <div className="text-xs font-mono">{a.day}</div>
                  <div className="text-[10px] text-muted-foreground">{a.ratio.toFixed(1)}× nad průměrem</div>
                </div>
                <div className="text-sm font-mono font-semibold text-destructive">{fmt(a.cost)}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
