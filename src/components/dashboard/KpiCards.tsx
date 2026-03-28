import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Activity, Clock, Hash } from "lucide-react";

interface KpiCardsProps {
  totalCost: number;
  totalRequests: number;
  totalTokens: number;
  avgGenTime: number;
}

const kpis = [
  { key: "cost", label: "Total Cost", icon: DollarSign, format: (v: number) => `$${v.toFixed(4)}`, color: "text-chart-1" },
  { key: "requests", label: "Requests", icon: Activity, format: (v: number) => v.toLocaleString(), color: "text-chart-2" },
  { key: "avgTime", label: "Avg Response", icon: Clock, format: (v: number) => `${(v / 1000).toFixed(1)}s`, color: "text-chart-3" },
  { key: "tokens", label: "Total Tokens", icon: Hash, format: (v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : v.toLocaleString(), color: "text-chart-4" },
] as const;

export function KpiCards({ totalCost, totalRequests, totalTokens, avgGenTime }: KpiCardsProps) {
  const values = { cost: totalCost, requests: totalRequests, avgTime: avgGenTime, tokens: totalTokens };

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
