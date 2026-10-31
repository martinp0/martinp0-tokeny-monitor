import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { CHART_SERIES, CHART_GRID, CHART_AXIS, CHART_FONT, chartTooltipStyle } from "@/lib/chart-theme";
import { fmtNum } from "@/lib/format";

interface Props {
  data: { time: string; tokens_prompt: number; tokens_completion: number; tokens_reasoning: number; tokens_cached: number }[];
}

export function TokensChart({ data }: Props) {
  return (
    <Card className="bg-card border-border/50 min-w-0 max-w-full overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-[15px] font-semibold tracking-tight text-foreground">Tokeny na požadavek</CardTitle>
      </CardHeader>
      <CardContent className="h-[280px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="0" vertical={false} stroke={CHART_GRID} />
            <XAxis dataKey="time" stroke={CHART_AXIS} tickLine={false} axisLine={false} fontSize={11} fontFamily={CHART_FONT} />
            <YAxis stroke={CHART_AXIS} tickLine={false} axisLine={false} fontSize={11} fontFamily={CHART_FONT} tickFormatter={(v) => v >= 1000 ? `${Math.round(v/1000)}K` : fmtNum(v)} />
            <Tooltip
              {...chartTooltipStyle}
              formatter={(value: number) => [fmtNum(value)]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="tokens_prompt" name="Prompt" stackId="a" fill={CHART_SERIES[1]} />
            <Bar dataKey="tokens_completion" name="Completion" stackId="a" fill={CHART_SERIES[0]} />
            <Bar dataKey="tokens_reasoning" name="Reasoning" stackId="a" fill={CHART_SERIES[2]} />
            <Bar dataKey="tokens_cached" name="Cached" stackId="a" fill={CHART_SERIES[3]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
