import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ActivityRow } from "@/lib/csv-parser";
import { useCurrency } from "@/hooks/useCurrency";
import { fmtCost, shortModel } from "@/lib/format";
import { Trophy, Zap } from "lucide-react";

interface Props {
  data: ActivityRow[];
}

interface ModelStat {
  model: string;
  cost: number;
  tokens: number;
  requests: number;
  avgLatency: number;
  costPer1kTokens: number;
  tokensPerSec: number;
}

export function ModelComparison({ data }: Props) {
  const { currency, exchangeRate } = useCurrency();

  const stats = useMemo<ModelStat[]>(() => {
    const buckets: Record<string, { cost: number; tokens: number; n: number; gen: number }> = {};
    for (const r of data) {
      const k = r.model_permaslug;
      if (!buckets[k]) buckets[k] = { cost: 0, tokens: 0, n: 0, gen: 0 };
      const t = r.tokens_prompt + r.tokens_completion + r.tokens_reasoning;
      buckets[k].cost += r.cost_total;
      buckets[k].tokens += t;
      buckets[k].n += 1;
      buckets[k].gen += r.generation_time_ms;
    }
    return Object.entries(buckets)
      .filter(([, v]) => v.tokens > 0)
      .map(([model, v]) => ({
        model,
        cost: v.cost,
        tokens: v.tokens,
        requests: v.n,
        avgLatency: v.gen / v.n,
        costPer1kTokens: (v.cost / v.tokens) * 1000,
        tokensPerSec: v.tokens / (v.gen / 1000),
      }))
      .sort((a, b) => a.costPer1kTokens - b.costPer1kTokens);
  }, [data]);

  if (stats.length === 0) return null;

  const cheapest = stats[0];
  const fastest = [...stats].sort((a, b) => b.tokensPerSec - a.tokensPerSec)[0];

  const fmt = (usd: number) => fmtCost(usd, 4, currency, exchangeRate);

  return (
    <Card className="glass border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          Porovnání modelů — value for money
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl bg-muted/60 border border-border p-3">
            <div className="text-xs text-muted-foreground tabular-nums uppercase">Nejlepší cena/výkon</div>
            <div className="text-sm font-semibold mt-1 truncate" title={cheapest.model}>{shortModel(cheapest.model, 28)}</div>
            <div className="text-xs tabular-nums text-primary mt-1">{fmt(cheapest.costPer1kTokens)} / 1k tok.</div>
          </div>
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-3">
            <div className="text-xs text-muted-foreground tabular-nums uppercase flex items-center gap-1"><Zap className="h-3 w-3" />Nejrychlejší</div>
            <div className="text-sm font-semibold mt-1 truncate" title={fastest.model}>{shortModel(fastest.model, 28)}</div>
            <div className="text-xs tabular-nums text-primary mt-1">{Math.round(fastest.tokensPerSec).toLocaleString("cs-CZ")} tok/s</div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-2 tabular-nums font-normal">Model</th>
                <th className="text-right py-2 tabular-nums font-normal">Req</th>
                <th className="text-right py-2 tabular-nums font-normal">Cost</th>
                <th className="text-right py-2 tabular-nums font-normal">$/1k tok</th>
                <th className="text-right py-2 tabular-nums font-normal">Tok/s</th>
                <th className="text-right py-2 tabular-nums font-normal">Latence</th>
              </tr>
            </thead>
            <tbody>
              {stats.slice(0, 10).map((s) => (
                <tr key={s.model} className="border-b border-border hover:bg-muted/60">
                  <td className="py-2 truncate max-w-[200px]" title={s.model}>{shortModel(s.model, 26)}</td>
                  <td className="text-right py-2 tabular-nums">{s.requests}</td>
                  <td className="text-right py-2 tabular-nums">{fmt(s.cost)}</td>
                  <td className="text-right py-2 tabular-nums text-primary">{fmt(s.costPer1kTokens)}</td>
                  <td className="text-right py-2 tabular-nums">{Math.round(s.tokensPerSec).toLocaleString("cs-CZ")}</td>
                  <td className="text-right py-2 tabular-nums text-muted-foreground">{Math.round(s.avgLatency)} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
