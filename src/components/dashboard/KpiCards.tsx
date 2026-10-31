import { Card, CardContent } from "@/components/ui/card";
import { Coins, Activity, Clock, Hash } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const values = { cost: totalCost, requests: totalRequests, avgTime: avgGenTime, tokens: totalTokens };

  const kpis = [
    { key: "cost" as const, icon: Coins, format: (v: number) => fmtCost(v, 0, currency, exchangeRate) },
    { key: "requests" as const, icon: Activity, format: (v: number) => fmtNum(v, currency) },
    { key: "avgTime" as const, icon: Clock, format: (v: number) => `${(v / 1000).toFixed(1)} s` },
    { key: "tokens" as const, icon: Hash, format: (v: number) => fmtNumShort(v, currency) },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 min-w-0">
      {kpis.map(({ key, icon: Icon, format }, index) => (
        <Card
          key={key}
          className="animate-fade-in overflow-hidden"
          style={{ animationDelay: `${index * 60}ms`, animationFillMode: "backwards" }}
        >
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3 text-muted-foreground">
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="text-[13px] font-medium leading-tight min-w-0">{t(`kpi.${key}`)}</span>
            </div>
            <p className="text-2xl sm:text-[28px] tabular-nums font-semibold tracking-tight leading-none break-words">
              {format(values[key])}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
