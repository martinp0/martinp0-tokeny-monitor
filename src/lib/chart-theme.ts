/**
 * One source of truth for chart styling. Colours resolve from CSS variables,
 * so every chart follows the light/dark theme automatically.
 */
export const CHART_SERIES = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6))",
] as const;

export const CHART_GRID = "hsl(var(--border))";
export const CHART_AXIS = "hsl(var(--muted-foreground))";
export const CHART_FONT = "inherit";

export const chartTooltipStyle = {
  contentStyle: {
    backgroundColor: "hsl(var(--popover) / 0.92)",
    backdropFilter: "blur(20px) saturate(180%)",
    WebkitBackdropFilter: "blur(20px) saturate(180%)",
    border: "1px solid hsl(var(--border))",
    borderRadius: 12,
    boxShadow: "0 8px 24px -12px rgb(0 0 0 / 0.25)",
    fontSize: 12,
    color: "hsl(var(--popover-foreground))",
  },
  labelStyle: { color: "hsl(var(--muted-foreground))", fontWeight: 500 },
  itemStyle: { color: "hsl(var(--popover-foreground))" },
  cursor: { fill: "hsl(var(--muted) / 0.6)", stroke: "hsl(var(--border))" },
} as const;
