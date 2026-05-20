import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, BookOpen, Calculator, Coffee, FileText, Github, Sparkles, TrendingDown, Zap } from "lucide-react";

// Indicative USD prices per 1M tokens (input / output). Approximate, for estimation.
const MODELS: { id: string; label: string; provider: string; inPrice: number; outPrice: number }[] = [
  { id: "gpt-5", label: "GPT-5", provider: "OpenAI", inPrice: 1.25, outPrice: 10 },
  { id: "gpt-5-mini", label: "GPT-5 mini", provider: "OpenAI", inPrice: 0.25, outPrice: 2 },
  { id: "gpt-4o", label: "GPT-4o", provider: "OpenAI", inPrice: 2.5, outPrice: 10 },
  { id: "gpt-4o-mini", label: "GPT-4o mini", provider: "OpenAI", inPrice: 0.15, outPrice: 0.6 },
  { id: "claude-sonnet-4", label: "Claude Sonnet 4", provider: "Anthropic", inPrice: 3, outPrice: 15 },
  { id: "claude-haiku-4", label: "Claude Haiku 4", provider: "Anthropic", inPrice: 0.8, outPrice: 4 },
  { id: "claude-opus-4", label: "Claude Opus 4", provider: "Anthropic", inPrice: 15, outPrice: 75 },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "Google", inPrice: 1.25, outPrice: 10 },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "Google", inPrice: 0.3, outPrice: 2.5 },
  { id: "llama-3.1-70b", label: "Llama 3.1 70B", provider: "Meta / OpenRouter", inPrice: 0.35, outPrice: 0.4 },
  { id: "deepseek-v3", label: "DeepSeek V3", provider: "DeepSeek", inPrice: 0.27, outPrice: 1.1 },
];

const USD_TO_CZK = 23;

function fmtUsd(n: number) {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}
function fmtCzk(n: number) {
  return `${Math.round(n).toLocaleString("cs-CZ")} Kč`;
}

export default function LlmCostCalculator() {
  const [modelId, setModelId] = useState("gpt-4o-mini");
  const [requests, setRequests] = useState(10000);
  const [inputTokens, setInputTokens] = useState(800);
  const [outputTokens, setOutputTokens] = useState(400);

  const model = MODELS.find((m) => m.id === modelId)!;

  const { perReqUsd, monthlyUsd, monthlyCzk, breakdown } = useMemo(() => {
    const inCost = (inputTokens / 1_000_000) * model.inPrice;
    const outCost = (outputTokens / 1_000_000) * model.outPrice;
    const perReq = inCost + outCost;
    const monthly = perReq * requests;
    return {
      perReqUsd: perReq,
      monthlyUsd: monthly,
      monthlyCzk: monthly * USD_TO_CZK,
      breakdown: MODELS.map((m) => {
        const c = ((inputTokens / 1_000_000) * m.inPrice + (outputTokens / 1_000_000) * m.outPrice) * requests;
        return { ...m, monthly: c };
      }).sort((a, b) => a.monthly - b.monthly),
    };
  }, [model, requests, inputTokens, outputTokens]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>LLM Cost Calculator — GPT, Claude, Gemini API Pricing | Tokeny Monitor</title>
        <meta
          name="description"
          content="Free LLM cost calculator. Estimate monthly API spend for GPT-5, Claude, Gemini, Llama and DeepSeek. Compare token pricing across providers in USD & CZK."
        />
        <meta name="keywords" content="llm cost calculator, ai cost calculator, openai pricing calculator, claude api cost, gpt api cost, token cost calculator, llm pricing" />
        <link rel="canonical" href="https://tokeny.pohl.uk/llm-cost-calculator" />
        <meta property="og:title" content="LLM Cost Calculator — GPT, Claude, Gemini" />
        <meta property="og:description" content="Estimate monthly LLM API spend across GPT-5, Claude, Gemini and more. Free, instant, no signup." />
        <meta property="og:url" content="https://tokeny.pohl.uk/llm-cost-calculator" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "LLM Cost Calculator",
          url: "https://tokeny.pohl.uk/llm-cost-calculator",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          description: "Free calculator to estimate monthly LLM API costs across GPT, Claude, Gemini and other models.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "How does the LLM cost calculator work?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Enter your expected number of requests and average input/output tokens. The calculator multiplies tokens by each provider's published per-million-token price to estimate monthly spend.",
              },
            },
            {
              "@type": "Question",
              name: "Which LLM is the cheapest?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "For most workloads, DeepSeek V3, GPT-4o mini, Gemini 2.5 Flash and Claude Haiku are among the cheapest. The right choice depends on quality requirements for your specific use case.",
              },
            },
            {
              "@type": "Question",
              name: "Is the calculator free?",
              acceptedAnswer: { "@type": "Answer", text: "Yes — fully free, no signup required." },
            },
          ],
        })}</script>
      </Helmet>

      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="font-display font-bold text-lg gradient-text">Tokeny Monitor</Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">Domů</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/auth">Začít zdarma <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 pt-16 pb-12 text-center max-w-4xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-mono mb-6">
          <Sparkles className="h-3 w-3" /> Free · No signup · Updated 2026
        </div>
        <h1 className="text-4xl md:text-6xl font-display font-bold tracking-tight mb-6">
          LLM Cost Calculator
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Spočítej, kolik tě bude měsíčně stát <strong className="text-foreground">GPT-5, Claude, Gemini</strong> nebo
          jakýkoli jiný LLM. Porovnej ceny napříč providery a najdi nejlevnější model pro svůj use case.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <a href="#calculator">
              <Calculator className="mr-2 h-5 w-5" /> Spustit kalkulačku
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth">Sledovat skutečné náklady <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      {/* Calculator */}
      <section id="calculator" className="container mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" /> Tvoje použití
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Select value={modelId} onValueChange={setModelId}>
                  <SelectTrigger id="model"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODELS.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label} <span className="text-muted-foreground">— {m.provider}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="requests">Počet requestů / měsíc</Label>
                <Input
                  id="requests" type="number" min={0} value={requests}
                  onChange={(e) => setRequests(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="in">Avg input tokenů</Label>
                  <Input
                    id="in" type="number" min={0} value={inputTokens}
                    onChange={(e) => setInputTokens(Math.max(0, Number(e.target.value) || 0))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="out">Avg output tokenů</Label>
                  <Input
                    id="out" type="number" min={0} value={outputTokens}
                    onChange={(e) => setOutputTokens(Math.max(0, Number(e.target.value) || 0))}
                  />
                </div>
              </div>

              <div className="text-xs text-muted-foreground font-mono pt-2 border-t border-border/40">
                {model.label}: ${model.inPrice}/1M input · ${model.outPrice}/1M output
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" /> Odhad nákladů
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="text-xs text-muted-foreground mb-1 font-mono uppercase">Měsíčně</div>
                <div className="text-5xl font-display font-bold gradient-text">{fmtUsd(monthlyUsd)}</div>
                <div className="text-lg text-muted-foreground mt-1">≈ {fmtCzk(monthlyCzk)}</div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/40">
                <div>
                  <div className="text-xs text-muted-foreground font-mono uppercase">Za request</div>
                  <div className="text-xl font-semibold">{fmtUsd(perReqUsd)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-mono uppercase">Ročně</div>
                  <div className="text-xl font-semibold">{fmtUsd(monthlyUsd * 12)}</div>
                </div>
              </div>

              <div className="flex items-start gap-2 text-sm text-muted-foreground bg-background/40 p-3 rounded-lg">
                <Coffee className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <span>To je zhruba <strong className="text-foreground">{Math.round(monthlyCzk / 70)}</strong> espress měsíčně.</span>
              </div>

              <Button asChild className="w-full" size="lg">
                <Link to="/auth">
                  Sledovat skutečné náklady v dashboardu <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <div className="text-xs text-muted-foreground text-center pt-2">
                Nebo prozkoumej <Link to="/gpt-api-cost" className="text-primary hover:underline">GPT ceník</Link> ·{" "}
                <Link to="/claude-api-cost" className="text-primary hover:underline">Claude ceník</Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Comparison */}
      <section className="container mx-auto px-4 py-12 max-w-6xl">
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-2 flex items-center gap-2">
          <TrendingDown className="h-7 w-7 text-primary" /> Porovnání modelů
        </h2>
        <p className="text-muted-foreground mb-6">
          Stejný workload ({requests.toLocaleString("cs-CZ")} requestů, {inputTokens} in / {outputTokens} out), seřazeno od nejlevnějšího.
        </p>
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border/40">
              {breakdown.map((m, i) => {
                const cheapest = breakdown[0].monthly;
                const ratio = cheapest > 0 ? m.monthly / cheapest : 1;
                return (
                  <div key={m.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="text-xs font-mono text-muted-foreground w-6">#{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{m.label}</div>
                      <div className="text-xs text-muted-foreground">{m.provider}</div>
                    </div>
                    <div className="hidden sm:block w-32">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-accent"
                          style={{ width: `${Math.min(100, (ratio / Math.max(1, breakdown[breakdown.length - 1].monthly / cheapest)) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{fmtUsd(m.monthly)}</div>
                      <div className="text-xs text-muted-foreground">{ratio.toFixed(1)}× nejlevnější</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* FAQ */}
      <section className="container mx-auto px-4 py-12 max-w-3xl">
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-6">FAQ</h2>
        <div className="space-y-4">
          <Card><CardContent className="p-5">
            <h3 className="font-semibold mb-2">Jak kalkulačka počítá náklady?</h3>
            <p className="text-sm text-muted-foreground">
              Vstupní a výstupní tokeny vynásobí cenou za 1M tokenů u daného modelu. Výsledek je orientační odhad podle publikovaných cen.
            </p>
          </CardContent></Card>
          <Card><CardContent className="p-5">
            <h3 className="font-semibold mb-2">Který LLM je nejlevnější?</h3>
            <p className="text-sm text-muted-foreground">
              Pro většinu úloh patří mezi nejlevnější DeepSeek V3, GPT-4o mini, Gemini Flash a Claude Haiku. Záleží ale hlavně na kvalitě, kterou potřebuješ.
            </p>
          </CardContent></Card>
          <Card><CardContent className="p-5">
            <h3 className="font-semibold mb-2">Jak zjistím skutečné náklady, ne jen odhad?</h3>
            <p className="text-sm text-muted-foreground">
              Nahraj CSV export z OpenRouter, nebo připoj OpenAI/Anthropic přes API klíč. Tokeny Monitor ti ukáže reálné náklady den po dni.
            </p>
          </CardContent></Card>
        </div>
      </section>

      {/* Related guides */}
      <section className="container mx-auto px-4 py-12 max-w-5xl">
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-6">Podrobné ceníky a návody</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="group hover:border-primary/50 transition-colors">
            <CardContent className="p-5">
              <FileText className="h-5 w-5 text-primary mb-3" />
              <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                <Link to="/gpt-api-cost">GPT API cost</Link>
              </h3>
              <p className="text-sm text-muted-foreground">
                Kompletní rozpis GPT-5, GPT-4o a mini — per token, per 1k i per 1M tokenů.
              </p>
            </CardContent>
          </Card>
          <Card className="group hover:border-primary/50 transition-colors">
            <CardContent className="p-5">
              <FileText className="h-5 w-5 text-primary mb-3" />
              <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                <Link to="/claude-api-cost">Claude API cost</Link>
              </h3>
              <p className="text-sm text-muted-foreground">
                Haiku, Sonnet a Opus — ceník per 1M tokenů a reálné měsíční příklady.
              </p>
            </CardContent>
          </Card>
          <Card className="group hover:border-primary/50 transition-colors">
            <CardContent className="p-5">
              <FileText className="h-5 w-5 text-primary mb-3" />
              <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                <Link to="/how-to-calculate-llm-cost">Jak spočítat LLM cost</Link>
              </h3>
              <p className="text-sm text-muted-foreground">
                Krok za krokem — odhad tokenů, vzorec a srovnání GPT vs Claude.
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="grid md:grid-cols-3 gap-4 mt-4">
          <Card className="group hover:border-primary/50 transition-colors">
            <CardContent className="p-5">
              <BookOpen className="h-5 w-5 text-primary mb-3" />
              <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                <Link to="/blog/ai-cost-saving">10 způsobů úspor</Link>
              </h3>
              <p className="text-sm text-muted-foreground">
                Jak snížit fakturu o 40–80 % — caching, batch API, routing a další.
              </p>
            </CardContent>
          </Card>
          <Card className="group hover:border-primary/50 transition-colors">
            <CardContent className="p-5">
              <BookOpen className="h-5 w-5 text-primary mb-3" />
              <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                <Link to="/blog/prompt-optimization">Optimalizace promptů</Link>
              </h3>
              <p className="text-sm text-muted-foreground">
                Zkrátit tokeny o 30–60 % a při tom zlepšit výsledky.
              </p>
            </CardContent>
          </Card>
          <Card className="group hover:border-primary/50 transition-colors">
            <CardContent className="p-5">
              <BookOpen className="h-5 w-5 text-primary mb-3" />
              <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                <Link to="/blog/token-window">Token window strategie</Link>
              </h3>
              <p className="text-sm text-muted-foreground">
                Kdy se vyplatí dlouhý kontext a kdy je lepší RAG nebo sliding window.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center max-w-2xl">
        <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
          Od odhadu k <span className="gradient-text">reálným číslům</span>
        </h2>
        <p className="text-muted-foreground mb-8">
          Kalkulačka ukáže, kolik bys mohl/a utratit. Tokeny Monitor ukáže, kolik utrácíš doopravdy — den po dni, model po modelu.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Začít zdarma <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href="https://github.com/martinp0/martinp0-tokeny-monitor" target="_blank" rel="noopener noreferrer">
              <Github className="mr-2 h-4 w-4" /> GitHub
            </a>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border/40 py-8 text-center text-sm text-muted-foreground">
        <p>Ceny jsou orientační, odpovídají publikovaným sazbám providerů ke květnu 2026.</p>
        <p className="mt-1">© {new Date().getFullYear()} <Link to="/" className="hover:text-foreground">Tokeny Monitor</Link></p>
      </footer>
    </div>
  );
}
