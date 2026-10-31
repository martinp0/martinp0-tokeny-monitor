import { Link } from "react-router-dom";
import { ExternalLink, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PROVIDER_LINKS, type AiKeyProblem, type AiProviderId } from "@/lib/ai-key";

function copy(problem: AiKeyProblem, label: string | null): { title: string; text: string } {
  switch (problem) {
    case "missing":
      return {
        title: "Přidej svůj vlastní AI klíč",
        text: "AI funkce v Tokeny běží na tvém klíči Anthropic, OpenAI nebo OpenRouter. Za AI platíš přímo zvolenému poskytovateli podle jeho ceníku, Tokeny si za ni nic neúčtuje.",
      };
    case "invalid":
      return {
        title: `${label ?? "Poskytovatel"} tvůj klíč odmítl`,
        text: "Klíč je neplatný nebo zrušený. Vytvoř si nový u poskytovatele a ulož ho v Nastavení.",
      };
    case "no_credit":
      return {
        title: `Na účtu ${label ?? "u poskytovatele"} došel kredit`,
        text: "Dobij si kredit nebo zvyš limit útraty přímo u poskytovatele. Platíš mu napřímo, ne Tokeny.",
      };
    case "model":
      return {
        title: "Zvolený model není dostupný",
        text: "Poskytovatel tento model nezná nebo k němu tvůj klíč nemá přístup. Vyber jiný model v Nastavení.",
      };
  }
}

/** Liquid Glass empty state shown when the AI features have no usable key of the user's own. */
export function AiKeyEmptyState({ problem = "missing", provider = null, className }: { problem?: AiKeyProblem; provider?: AiProviderId | null; className?: string }) {
  const p = provider ? PROVIDER_LINKS[provider] : null;
  const c = copy(problem, p?.label ?? null);
  return (
    <div className={cn("glass-panel rounded-3xl p-5 text-center space-y-3", className)} role="status">
      <div className="mx-auto h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center">
        <KeyRound className="h-5 w-5 text-primary" aria-hidden />
      </div>
      <h3 className="text-base font-semibold tracking-tight">{c.title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{c.text}</p>
      <div className="flex flex-wrap justify-center gap-2 pt-1">
        <Button asChild size="sm">
          <Link to="/settings#ai-key">{problem === "missing" ? "Přidat klíč v Nastavení" : "Otevřít Nastavení"}</Link>
        </Button>
        {(p ? [p] : problem === "missing" ? Object.values(PROVIDER_LINKS) : []).map((l) => (
          <Button key={l.host} asChild size="sm" variant="outline" className="gap-1.5">
            <a href={problem === "no_credit" ? l.billingUrl : l.keysUrl} target="_blank" rel="noopener noreferrer">
              {l.host} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </Button>
        ))}
      </div>
    </div>
  );
}
