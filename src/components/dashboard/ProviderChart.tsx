import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { fmtCost, fmtCostShort, fmtNum } from "@/lib/format";
import { useCurrency } from "@/hooks/useCurrency";

interface Props {
  data: { provider: string; cost: number; requests: number }[];
}

export function ProviderChart({ data }: Props) {
  const { currency } = useCurrency();

  return (
    <Card className="bg-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider">Náklady dle providera</CardTitle>
      </CardHeader>
      <CardContent className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(232, 25%, 18%)" horizontal={false} />
            <XAxis type="number" stroke="hsl(220, 15%, 55%)" fontSize={11} fontFamily="JetBrains Mono" tickFormatter={(v) => fmtCostShort(v, currency)} />
            <YAxis type="category" dataKey="provider" stroke="hsl(220, 15%, 55%)" fontSize={11} fontFamily="JetBrains Mono" width={80} />
            <Tooltip
              contentStyle={{ backgroundColor: "hsl(232, 40%, 12%)", border: "1px solid hsl(232, 25%, 18%)", borderRadius: 8, fontFamily: "JetBrains Mono", fontSize: 12 }}
              formatter={(value: number, name: string) => [name === "cost" ? fmtCost(value, 6, currency) : fmtNum(value, currency), name === "cost" ? "Náklady" : "Požadavky"]}
            />
            <Bar dataKey="cost" fill="hsl(190, 100%, 50%)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
