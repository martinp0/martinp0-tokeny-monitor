import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { fmtCost } from "@/lib/format";
import { shortModel } from "@/lib/format";
import { useCurrency } from "@/hooks/useCurrency";

const COLORS = [
  "hsl(160, 100%, 50%)",
  "hsl(190, 100%, 50%)",
  "hsl(35, 100%, 55%)",
  "hsl(280, 100%, 65%)",
  "hsl(340, 100%, 60%)",
  "hsl(60, 100%, 55%)",
];

interface Props {
  data: { model: string; fullModel: string; cost: number }[];
  onModelClick?: (model: string | null) => void;
  selectedModel: string | null;
}

export function ModelCostChart({ data, onModelClick, selectedModel }: Props) {
  const { currency, exchangeRate } = useCurrency();

  return (
    <Card className="bg-card border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider">Náklady dle modelu</CardTitle>
          {selectedModel && (
            <button onClick={() => onModelClick?.(null)} className="text-xs text-primary hover:underline font-mono">
              Zrušit filtr
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="h-[280px]">
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
              stroke="hsl(232, 40%, 10%)"
              onClick={(entry) => onModelClick?.(entry.fullModel)}
              className="cursor-pointer"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={selectedModel && data[i]?.fullModel !== selectedModel ? 0.3 : 1} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: "hsl(232, 40%, 12%)", border: "1px solid hsl(232, 25%, 18%)", borderRadius: 8, fontFamily: "JetBrains Mono", fontSize: 12 }}
              formatter={(value: number, _name, item: any) => [fmtCost(value, 6, currency, exchangeRate), item?.payload?.fullModel ?? "Náklady"]}
            />
            <Legend wrapperStyle={{ fontSize: 11, fontFamily: "JetBrains Mono" }} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
