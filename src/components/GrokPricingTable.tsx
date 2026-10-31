import { GROK_MODELS, GROK_PRICING_CHECKED, GROK_PRICING_URL, fmtUsd } from "@/lib/grok-pricing";

export function GrokPricingTable() {
  return (
    <div className="not-prose">
      <div className="overflow-x-auto rounded-xl border border-border/40">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="bg-muted/40">
              <th className="px-4 py-3 text-left font-semibold">Model</th>
              <th className="px-4 py-3 text-right font-semibold">Kontext</th>
              <th className="px-4 py-3 text-right font-semibold text-primary">Input / 1M</th>
              <th className="px-4 py-3 text-right font-semibold">Cached / 1M</th>
              <th className="px-4 py-3 text-right font-semibold text-primary">Output / 1M</th>
              <th className="px-4 py-3 text-right font-semibold">Long ctx in / out</th>
            </tr>
          </thead>
          <tbody>
            {GROK_MODELS.map((m) => (
              <tr key={m.model} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3 tabular-nums font-medium">{m.model}</td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{m.context}</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-primary">{fmtUsd(m.input)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{fmtUsd(m.cached)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-primary">{fmtUsd(m.output)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {fmtUsd(m.longInput)} / {fmtUsd(m.longOutput)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Ceny v USD za 1M tokenů dle{" "}
        <a href={GROK_PRICING_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
          oficiálního ceníku xAI
        </a>{" "}
        (ověřeno {GROK_PRICING_CHECKED}). Jakmile prompt dosáhne 200k tokenů, účtuje se celý request dražší
        „long context“ sazbou. US regionální endpoint je o 10 % dražší.
      </p>
    </div>
  );
}
