import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { CHART_SERIES, chartTooltipStyle } from "@/lib/chart-theme";
import { fmtCost } from "@/lib/format";
import { shortModel } from "@/lib/format";
import { useCurrency } from "@/hooks/useCurrency";

const COLORS = CHART_SERIES;

interface Props {
  data: { model: string; fullModel: string; cost: number }[];
  onModelClick?: (model: string | null) => void;
  selectedModel: string | null;
}

export function ModelCostChart({ data, onModelClick, selectedModel }: Props) {
  const { currency, exchangeRate } = useCurrency();

  return (
    <Card className="bg-card border-border/50 min-w-0 max-w-full overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[15px] font-semibold tracking-tight text-foreground">Náklady dle modelu</CardTitle>
          {selectedModel && (
            <button onClick={() => onModelClick?.(null)} className="text-xs text-primary hover:underline tabular-nums">
              Zrušit filtr
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="h-[280px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data.map((d) => ({ ...d, model: shortModel(d.model, 24) }))}
              dataKey="cost"
              nameKey="model"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={90}
              strokeWidth={2}
              stroke="hsl(var(--card))"
              onClick={(entry) => onModelClick?.(entry.fullModel)}
              className="cursor-pointer"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={selectedModel && data[i]?.fullModel !== selectedModel ? 0.3 : 1} />
              ))}
            </Pie>
            <Tooltip
              {...chartTooltipStyle}
              formatter={(value: number, _name, item: { payload?: { fullModel?: string } }) => [fmtCost(value, 6, currency, exchangeRate), item?.payload?.fullModel ?? "Náklady"]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
