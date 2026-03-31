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
    { key: "cost" as const, label: "Celkové náklady", emoji: "💸", icon: DollarSign, format: (v: number) => fmtCost(v, 0, currency, exchangeRate), color: "text-chart-1", glow: "from-[hsl(270,95%,65%)]" },
    { key: "requests" as const, label: "Požadavky", emoji: "⚡", icon: Activity, format: (v: number) => fmtNum(v, currency), color: "text-chart-2", glow: "from-[hsl(175,85%,55%)]" },
    { key: "avgTime" as const, label: "Prům. odpověď", emoji: "⏱️", icon: Clock, format: (v: number) => `${(v / 1000).toFixed(1)}s`, color: "text-chart-3", glow: "from-[hsl(45,100%,60%)]" },
    { key: "tokens" as const, label: "Celkem tokenů", emoji: "🔥", icon: Hash, format: (v: number) => fmtNumShort(v, currency), color: "text-chart-4", glow: "from-[hsl(320,90%,65%)]" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {kpis.map(({ key, label, emoji, icon: Icon, format, color, glow }, index) => (
        <Card
          key={key}
          className="glass glass-hover group cursor-default animate-fade-in opacity-0 overflow-hidden relative"
          style={{ animationDelay: `${index * 80}ms`, animationFillMode: "forwards" }}
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${glow} to-transparent opacity-0 group-hover:opacity-[0.06] transition-opacity duration-500`} />
          <CardContent className="p-4 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
              <span className="text-lg group-hover:animate-float">{emoji}</span>
            </div>
            <p className={`text-2xl font-mono font-bold ${color}`}>{format(values[key])}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
