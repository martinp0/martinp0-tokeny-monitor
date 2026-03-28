import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Props {
  data: { time: string; tokens_prompt: number; tokens_completion: number; tokens_reasoning: number; tokens_cached: number }[];
}

export function TokensChart({ data }: Props) {
  return (
    <Card className="bg-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider">Tokens Per Request</CardTitle>
      </CardHeader>
      <CardContent className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(232, 25%, 18%)" />
            <XAxis dataKey="time" stroke="hsl(220, 15%, 55%)" fontSize={11} fontFamily="JetBrains Mono" />
            <YAxis stroke="hsl(220, 15%, 55%)" fontSize={11} fontFamily="JetBrains Mono" tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
            <Tooltip
              contentStyle={{ backgroundColor: "hsl(232, 40%, 12%)", border: "1px solid hsl(232, 25%, 18%)", borderRadius: 8, fontFamily: "JetBrains Mono", fontSize: 12 }}
              labelStyle={{ color: "hsl(220, 20%, 90%)" }}
            />
            <Legend wrapperStyle={{ fontSize: 11, fontFamily: "JetBrains Mono" }} />
            <Bar dataKey="tokens_prompt" name="Prompt" stackId="a" fill="hsl(190, 100%, 50%)" />
            <Bar dataKey="tokens_completion" name="Completion" stackId="a" fill="hsl(160, 100%, 50%)" />
            <Bar dataKey="tokens_reasoning" name="Reasoning" stackId="a" fill="hsl(280, 100%, 65%)" />
            <Bar dataKey="tokens_cached" name="Cached" stackId="a" fill="hsl(35, 100%, 55%)" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
