import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Calculator, Check, ListChecks } from "lucide-react";

export default function HowToCalculateLlmCost() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>How to Calculate LLM Cost — Step-by-Step Guide 2026 | Tokeny Monitor</title>
        <meta
          name="description"
          content="Step-by-step guide to calculate LLM cost: how tokens are priced, formula, real examples for GPT, Claude and Gemini. Free calculator included."
        />
        <meta name="keywords" content="llm cost calculator, how to calculate llm cost, token cost formula, ai api cost calculation, llm pricing explained" />
        <link rel="canonical" href="https://tokeny.pohl.uk/how-to-calculate-llm-cost" />
        <meta property="og:title" content="How to Calculate LLM Cost — Step-by-Step" />
        <meta property="og:description" content="Token pricing, formula and real examples. With a free LLM cost calculator." />
        <meta property="og:url" content="https://tokeny.pohl.uk/how-to-calculate-llm-cost" />
        <meta property="og:type" content="article" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: "How to calculate LLM cost",
          description: "Step-by-step method to estimate monthly LLM API spend from tokens and per-million pricing.",
          step: [
            { "@type": "HowToStep", name: "Estimate tokens per request", text: "Roughly 4 characters = 1 token in English. Count average input and output tokens per request." },
            { "@type": "HowToStep", name: "Get per-million pricing", text: "Find provider's USD price per 1M input and 1M output tokens." },
            { "@type": "HowToStep", name: "Apply the formula", text: "cost_per_request = (input_tokens/1M)*in_price + (output_tokens/1M)*out_price; multiply by monthly requests." },
          ],
        })}</script>
      </Helmet>

      <header className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="font-display font-bold text-lg gradient-text">Tokeny Monitor</Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/llm-cost-calculator">Kalkulačka</Link></Button>
            <Button asChild size="sm"><Link to="/auth">Začít zdarma <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
          </div>
        </div>
      </header>

      <article className="container mx-auto px-4 py-16 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-mono mb-6">
          <ListChecks className="h-3 w-3" /> Guide · 3 minuty čtení
        </div>
        <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-4">
          Jak spočítat cenu LLM API ve 3 krocích
        </h1>
        <p className="text-lg text-muted-foreground mb-10">
          Krátký návod, jak z počtu requestů a průměrné velikosti promptu dostat reálný měsíční odhad.
          Funguje stejně pro GPT, Claude i Gemini.
        </p>

        <h2 className="text-2xl font-display font-bold mb-3">1. Odhadni počet tokenů</h2>
        <p className="text-muted-foreground mb-3">
          Pravidlo palce pro angličtinu: <strong className="text-foreground">~4 znaky = 1 token</strong> (čeština ~3).
          Vezmi 10 typických requestů, spočítej průměr vstupu a výstupu.
        </p>
        <Card className="mb-8"><CardContent className="p-4 font-mono text-sm">
          input ≈ délka systémového promptu + uživatelský dotaz<br/>
          output ≈ průměrná délka odpovědi
        </CardContent></Card>

        <h2 className="text-2xl font-display font-bold mb-3">2. Najdi ceny providera</h2>
        <p className="text-muted-foreground mb-3">
          Ceny LLM se udávají <strong className="text-foreground">per 1 milion tokenů</strong>, zvlášť pro vstup a výstup. Output bývá 3–5× dražší.
        </p>
        <ul className="space-y-2 mb-8 text-sm">
          <li className="flex gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> GPT-4o mini: $0.15 in / $0.60 out</li>
          <li className="flex gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Claude Sonnet 4: $3 in / $15 out</li>
          <li className="flex gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Gemini 2.5 Flash: $0.30 in / $2.50 out</li>
        </ul>

        <h2 className="text-2xl font-display font-bold mb-3">3. Aplikuj vzorec</h2>
        <Card className="mb-4"><CardContent className="p-4 font-mono text-sm bg-muted/30">
          cost_per_req = (input/1M)*in_price + (output/1M)*out_price<br/>
          monthly = cost_per_req * requests_per_month
        </CardContent></Card>
        <p className="text-muted-foreground mb-10">
          Příklad: 10 000 req × 800 in / 400 out na GPT-4o mini ={" "}
          <strong className="text-foreground">$3.60/měsíc</strong>. Na Claude Sonnet 4 to samé = <strong className="text-foreground">$84/měsíc</strong>.
          Rozdíl 23× — proto se vyplatí počítat předem.
        </p>

        <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <Calculator className="h-6 w-6 text-primary shrink-0 mt-1" />
              <div>
                <h3 className="font-display font-bold text-xl mb-1">Nechce se ti počítat ručně?</h3>
                <p className="text-muted-foreground text-sm">
                  LLM Cost Calculator to udělá za tebe — 11 modelů, okamžité srovnání, USD i CZK.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild><Link to="/llm-cost-calculator">Spustit kalkulačku <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
              <Button asChild variant="outline"><Link to="/claude-api-cost">Claude API ceník</Link></Button>
              <Button asChild variant="outline"><Link to="/gpt-api-cost">GPT API ceník</Link></Button>
            </div>
            <div className="mt-4 pt-4 border-t border-border/40 text-sm text-muted-foreground">
              Další návody: <Link to="/blog/ai-cost-saving" className="text-primary hover:underline">10 způsobů úspor</Link> ·{" "}
              <Link to="/blog/prompt-optimization" className="text-primary hover:underline">Optimalizace promptů</Link> ·{" "}
              <Link to="/blog/token-window" className="text-primary hover:underline">Token window</Link>
            </div>
          </CardContent>
        </Card>
      </article>

      <footer className="border-t border-border/40 py-8 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} <Link to="/" className="hover:text-foreground">Tokeny Monitor</Link></p>
      </footer>
    </div>
  );
}
