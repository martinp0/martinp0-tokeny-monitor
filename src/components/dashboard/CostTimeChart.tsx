import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CHART_SERIES, CHART_GRID, CHART_AXIS, CHART_FONT, chartTooltipStyle } from "@/lib/chart-theme";
import { fmtCost, fmtCostShort } from "@/lib/format";
import { useCurrency } from "@/hooks/useCurrency";

interface Props {
  data: { time: string; cost: number; model: string }[];
}

export function CostTimeChart({ data }: Props) {
  const { currency, exchangeRate } = useCurrency();

  return (
    <Card className="bg-card border-border/50 min-w-0 max-w-full overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-[15px] font-semibold tracking-tight text-foreground">Náklady v čase</CardTitle>
      </CardHeader>
      <CardContent className="h-[280px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_SERIES[0]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART_SERIES[0]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="0" vertical={false} stroke={CHART_GRID} />
            <XAxis dataKey="time" stroke={CHART_AXIS} tickLine={false} axisLine={false} fontSize={11} fontFamily={CHART_FONT} />
            <YAxis stroke={CHART_AXIS} tickLine={false} axisLine={false} fontSize={11} fontFamily={CHART_FONT} tickFormatter={(v) => fmtCostShort(v, currency, exchangeRate)} />
            <Tooltip
              {...chartTooltipStyle}
              formatter={(value: number) => [fmtCost(value, 6, currency, exchangeRate), "Náklady"]}
            />
            <Area type="monotone" dataKey="cost" stroke={CHART_SERIES[0]} fill="url(#costGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
