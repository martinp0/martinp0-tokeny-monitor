import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Activity, Clock, Hash } from "lucide-react";
import { fmtCost, fmtNum, fmtNumShort } from "@/lib/format";
import { useCurrency } from "@/hooks/useCurrency";

interface KpiCardsProps {
  totalCost: number;
  totalRequests: number;
  totalTokens: number;
  avgGenTime: number;
}

export function KpiCards({ totalCost, totalRequests, totalTokens, avgGenTime }: KpiCardsProps) {
  const { currency, exchangeRate } = useCurrency();
  const values = { cost: totalCost, requests: totalRequests, avgTime: avgGenTime, tokens: totalTokens };

  const kpis = [
    { key: "cost" as const, label: "Celkové náklady", icon: DollarSign, format: (v: number) => fmtCost(v, 4, currency, exchangeRate), color: "text-chart-1" },
    { key: "requests" as const, label: "Požadavky", icon: Activity, format: (v: number) => fmtNum(v, currency), color: "text-chart-2" },
    { key: "avgTime" as const, label: "Prům. odpověď", icon: Clock, format: (v: number) => `${(v / 1000).toFixed(1)}s`, color: "text-chart-3" },
    { key: "tokens" as const, label: "Celkem tokenů", icon: Hash, format: (v: number) => fmtNumShort(v, currency), color: "text-chart-4" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {kpis.map(({ key, label, icon: Icon, format, color }) => (
        <Card key={key} className="bg-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <p className={`text-2xl font-mono font-bold ${color}`}>{format(values[key])}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
