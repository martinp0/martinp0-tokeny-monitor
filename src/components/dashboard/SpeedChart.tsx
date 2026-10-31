import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { CHART_SERIES, CHART_GRID, CHART_AXIS, CHART_FONT, chartTooltipStyle } from "@/lib/chart-theme";
import { fmtNum } from "@/lib/format";

interface Props {
  data: { time: string; generation_time_ms: number; time_to_first_token_ms: number }[];
}

export function SpeedChart({ data }: Props) {
  return (
    <Card className="bg-card border-border/50 min-w-0 max-w-full overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-[15px] font-semibold tracking-tight text-foreground">Rychlost odpovědi</CardTitle>
      </CardHeader>
      <CardContent className="h-[280px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="0" vertical={false} stroke={CHART_GRID} />
            <XAxis dataKey="time" stroke={CHART_AXIS} tickLine={false} axisLine={false} fontSize={11} fontFamily={CHART_FONT} />
            <YAxis stroke={CHART_AXIS} tickLine={false} axisLine={false} fontSize={11} fontFamily={CHART_FONT} tickFormatter={(v) => `${(v/1000).toFixed(0)}s`} />
            <Tooltip
              {...chartTooltipStyle}
              formatter={(value: number, name: string) => [`${fmtNum(value)} ms`, name]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="generation_time_ms" name="Generation Time" stroke={CHART_SERIES[3]} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="time_to_first_token_ms" name="TTFT" stroke={CHART_SERIES[2]} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
