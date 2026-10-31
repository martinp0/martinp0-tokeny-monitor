import { Card, CardContent } from "@/components/ui/card";
import { Layers } from "lucide-react";
import { fmtCost, fmtNum, fmtNumShort } from "@/lib/format";
import { useCurrency } from "@/hooks/useCurrency";
import type { UsageBreakdown } from "@/lib/usage-export";

/** Cached vs fresh tokens and plan vs over-plan cost for imported Cursor / Grok Bot usage. */
export function UsageBreakdownCard({ data }: { data: UsageBreakdown }) {
  const { currency, exchangeRate } = useCurrency();
  const input = data.freshInput + data.cachedRead + data.cacheWrite;
  const pct = (n: number) => (input > 0 ? `${Math.round((n / input) * 100)} %` : "–");
  const tokens = [
    { label: "Čtení z mezipaměti", value: data.cachedRead, share: pct(data.cachedRead) },
    { label: "Zápis do mezipaměti", value: data.cacheWrite, share: pct(data.cacheWrite) },
    { label: "Nový vstup", value: data.freshInput, share: pct(data.freshInput) },
    { label: "Výstup", value: data.output, share: "" },
  ];
  const billing = [
    { label: "V ceně tarifu", cost: data.includedCost, calls: data.includedCalls },
    { label: "Nad rámec tarifu", cost: data.onDemandCost, calls: data.onDemandCalls },
    ...(data.creditsCalls > 0 ? [{ label: "Z kreditů", cost: data.creditsCost, calls: data.creditsCalls }] : []),
  ];
  return (
    <Card className="animate-fade-in">
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Layers className="h-4 w-4" aria-hidden />
          <h3 className="text-[13px] font-medium">Cursor a Grok Bot: tokeny a tarif</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <dl className="space-y-1.5 text-sm">
            {tokens.map((t) => (
              <div key={t.label} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t.label}</dt>
                <dd className="tabular-nums">
                  {fmtNumShort(t.value, currency)} {t.share && <span className="text-muted-foreground">({t.share})</span>}
                </dd>
              </div>
            ))}
          </dl>
          <dl className="space-y-1.5 text-sm">
            {billing.map((b) => (
              <div key={b.label} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{b.label}</dt>
                <dd className="tabular-nums">
                  {fmtCost(b.cost, 2, currency, exchangeRate)}{" "}
                  <span className="text-muted-foreground">· {fmtNum(b.calls, currency)} volání</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}
