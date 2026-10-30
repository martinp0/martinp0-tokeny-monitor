import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CHART_SERIES, CHART_GRID, CHART_AXIS, CHART_FONT, chartTooltipStyle } from "@/lib/chart-theme";
import { fmtCost, fmtCostShort, fmtNum } from "@/lib/format";
import { useCurrency } from "@/hooks/useCurrency";

interface Props {
  data: { provider: string; cost: number; requests: number }[];
}

export function ProviderChart({ data }: Props) {
  const { currency, exchangeRate } = useCurrency();

  return (
    <Card className="bg-card border-border/50 min-w-0 max-w-full overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-[15px] font-semibold tracking-tight text-foreground">Náklady dle providera</CardTitle>
      </CardHeader>
      <CardContent className="h-[280px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="0" vertical={false} stroke={CHART_GRID} horizontal={false} />
            <XAxis type="number" stroke={CHART_AXIS} tickLine={false} axisLine={false} fontSize={11} fontFamily={CHART_FONT} tickFormatter={(v) => fmtCostShort(v, currency, exchangeRate)} />
            <YAxis type="category" dataKey="provider" stroke={CHART_AXIS} tickLine={false} axisLine={false} fontSize={11} fontFamily={CHART_FONT} width={80} />
            <Tooltip
              {...chartTooltipStyle}
              formatter={(value: number, name: string) => [name === "cost" ? fmtCost(value, 6, currency, exchangeRate) : fmtNum(value, currency), name === "cost" ? "Náklady" : "Požadavky"]}
            />
            <Bar dataKey="cost" fill={CHART_SERIES[1]} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
