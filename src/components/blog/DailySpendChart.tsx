import { DAILY_USD } from "./daily-spend-data";

const fmt = (n: number) => n.toLocaleString("cs-CZ", { maximumFractionDigits: n < 10 ? 2 : 0 });

export function DailySpendChart() {
  const max = Math.max(...DAILY_USD.map((d) => d.grokBot + d.cursor));
  return (
    <figure className="not-prose glass rounded-2xl p-4 sm:p-6 my-8">
      <div
        className="flex items-end gap-[3px] h-48"
        role="img"
        aria-label="Sloupcový graf denní útraty nad rámec tarifu, 1.–30. října 2026. Nejvyšší 22. října 258 USD."
      >
        {DAILY_USD.map((d) => {
          const total = d.grokBot + d.cursor;
          return (
            <div key={d.day} className="flex-1 h-full flex flex-col justify-end" title={`${d.day}. 10.: ${fmt(total)} USD`}>
              <div className="bg-sky-400/80 rounded-t-sm" style={{ height: `${(d.cursor / max) * 100}%` }} />
              <div
                className={`bg-primary ${d.cursor === 0 ? "rounded-t-sm" : ""}`}
                style={{ height: `${(d.grokBot / max) * 100}%`, minHeight: total === 0 ? 1 : undefined }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[11px] tabular-nums text-muted-foreground mt-2">
        <span>1. 10.</span>
        <span>10. 10.</span>
        <span>20. 10.</span>
        <span>30. 10.</span>
      </div>
      <figcaption className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Grok Bot</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-sky-400/80" /> Cursor</span>
        <span>Útrata nad rámec tarifu v USD za den (dny podle času v Praze). Max. 22. 10.: 258 USD.</span>
      </figcaption>
    </figure>
  );
}
