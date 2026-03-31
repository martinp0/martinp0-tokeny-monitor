import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { fmtCost, fmtCostShort } from "@/lib/format";

interface Props {
  data: { time: string; cost: number; model: string }[];
}

export function CostTimeChart({ data }: Props) {
  return (
    <Card className="bg-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider">Náklady v čase</CardTitle>
      </CardHeader>
      <CardContent className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(160, 100%, 50%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(160, 100%, 50%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(232, 25%, 18%)" />
            <XAxis dataKey="time" stroke="hsl(220, 15%, 55%)" fontSize={11} fontFamily="JetBrains Mono" />
            <YAxis stroke="hsl(220, 15%, 55%)" fontSize={11} fontFamily="JetBrains Mono" tickFormatter={(v) => fmtCostShort(v)} />
            <Tooltip
              contentStyle={{ backgroundColor: "hsl(232, 40%, 12%)", border: "1px solid hsl(232, 25%, 18%)", borderRadius: 8, fontFamily: "JetBrains Mono", fontSize: 12 }}
              labelStyle={{ color: "hsl(220, 20%, 90%)" }}
              itemStyle={{ color: "hsl(160, 100%, 50%)" }}
              formatter={(value: number) => [fmtCost(value, 6), "Náklady"]}
            />
            <Area type="monotone" dataKey="cost" stroke="hsl(160, 100%, 50%)" fill="url(#costGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
