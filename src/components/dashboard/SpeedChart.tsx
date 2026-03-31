import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { fmtNum } from "@/lib/format";

interface Props {
  data: { time: string; generation_time_ms: number; time_to_first_token_ms: number }[];
}

export function SpeedChart({ data }: Props) {
  return (
    <Card className="bg-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider">Rychlost odpovědi</CardTitle>
      </CardHeader>
      <CardContent className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(232, 25%, 18%)" />
            <XAxis dataKey="time" stroke="hsl(220, 15%, 55%)" fontSize={11} fontFamily="JetBrains Mono" />
            <YAxis stroke="hsl(220, 15%, 55%)" fontSize={11} fontFamily="JetBrains Mono" tickFormatter={(v) => `${(v/1000).toFixed(0)}s`} />
            <Tooltip
              contentStyle={{ backgroundColor: "hsl(232, 40%, 12%)", border: "1px solid hsl(232, 25%, 18%)", borderRadius: 8, fontFamily: "JetBrains Mono", fontSize: 12 }}
              formatter={(value: number, name: string) => [`${fmtNum(value)} ms`, name]}
            />
            <Legend wrapperStyle={{ fontSize: 11, fontFamily: "JetBrains Mono" }} />
            <Line type="monotone" dataKey="generation_time_ms" name="Generation Time" stroke="hsl(35, 100%, 55%)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="time_to_first_token_ms" name="TTFT" stroke="hsl(280, 100%, 65%)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
