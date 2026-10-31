import { Link } from "react-router-dom";
import { ExternalLink, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ANTHROPIC_KEYS_URL, type AiKeyProblem } from "@/lib/ai-key";

const COPY: Record<AiKeyProblem, { title: string; text: string }> = {
  missing: {
    title: "Přidej svůj API klíč Anthropic",
    text: "AI funkce v Tokeny běží na tvém vlastním klíči. Za AI platíš přímo Anthropicu podle jejich ceníku, Tokeny si za ni nic neúčtuje.",
  },
  invalid: {
    title: "Anthropic tvůj klíč odmítl",
    text: "Klíč je neplatný nebo zrušený. Vytvoř si nový v Anthropic Console a ulož ho v Nastavení.",
  },
  no_credit: {
    title: "Na účtu Anthropic došel kredit",
    text: "Dobij si kredit v Anthropic Console. Platíš ho přímo Anthropicu, ne Tokeny.",
  },
};

/** Liquid Glass empty state shown when the AI features have no usable key of the user's own. */
export function AiKeyEmptyState({ problem = "missing", className }: { problem?: AiKeyProblem; className?: string }) {
  const c = COPY[problem];
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
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <a href={problem === "no_credit" ? "https://console.anthropic.com/settings/billing" : ANTHROPIC_KEYS_URL} target="_blank" rel="noopener noreferrer">
            console.anthropic.com <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </Button>
      </div>
    </div>
  );
}
