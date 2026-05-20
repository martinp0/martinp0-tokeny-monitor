import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Check, DollarSign, TrendingDown, Zap } from "lucide-react";

const CLAUDE_MODELS = [
  { name: "Claude Haiku 4", input: 0.8, output: 4, use: "Klasifikace, krátké odpovědi, vysoký objem" },
  { name: "Claude Sonnet 4", input: 3, output: 15, use: "Většina produkčních úloh, coding, agenti" },
  { name: "Claude Opus 4", input: 15, output: 75, use: "Komplexní reasoning, výzkum, dlouhý kontext" },
];

export default function ClaudeApiCost() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Claude API Cost 2026 — Pricing per Token & Real Examples | Tokeny Monitor</title>
        <meta
          name="description"
          content="Claude API cost breakdown for Haiku, Sonnet and Opus. Per-token pricing, real-world monthly examples and how to track actual spend in USD or CZK."
        />
        <meta name="keywords" content="claude api cost, claude api pricing, anthropic api cost, claude sonnet pricing, claude opus cost, claude haiku price" />
        <link rel="canonical" href="https://tokeny.pohl.uk/claude-api-cost" />
        <meta property="og:title" content="Claude API Cost 2026 — Full Pricing Breakdown" />
        <meta property="og:description" content="How much does the Claude API really cost? Haiku, Sonnet, Opus pricing with monthly examples." />
        <meta property="og:url" content="https://tokeny.pohl.uk/claude-api-cost" />
        <meta property="og:type" content="article" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Claude API Cost 2026 — Full Pricing Breakdown",
          description: "Per-token pricing for Claude Haiku, Sonnet and Opus with monthly cost examples.",
          author: { "@type": "Person", name: "Martin Pohl", url: "https://martin.pohl.uk" },
          datePublished: "2026-05-18",
          url: "https://tokeny.pohl.uk/claude-api-cost",
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            { "@type": "Question", name: "How much does the Claude API cost?",
              acceptedAnswer: { "@type": "Answer", text: "Claude Haiku 4 costs $0.80/1M input and $4/1M output tokens. Sonnet 4 is $3/$15. Opus 4 is $15/$75 per million tokens." } },
            { "@type": "Question", name: "Which Claude model is cheapest?",
              acceptedAnswer: { "@type": "Answer", text: "Claude Haiku 4 is the cheapest — roughly 4× cheaper than Sonnet and 18× cheaper than Opus on input tokens." } },
            { "@type": "Question", name: "How do I track real Claude API spend?",
              acceptedAnswer: { "@type": "Answer", text: "Connect your Anthropic API key in Tokeny Monitor or upload a CSV export. The dashboard shows daily cost in USD or CZK." } },
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
          <DollarSign className="h-3 w-3" /> Anthropic API · Pricing 2026
        </div>
        <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-4">
          Claude API Cost: kolik tě opravdu stojí Haiku, Sonnet a Opus
        </h1>
        <p className="text-lg text-muted-foreground mb-10">
          Krátký, přímý rozpad ceny Claude API podle modelu — bez marketingu, jen čísla a praktické příklady,
          kolik utratíš za reálný workload.
        </p>

        <h2 className="text-2xl font-display font-bold mb-4">Ceník per 1M tokenů</h2>
        <Card className="mb-10">
          <CardContent className="p-0">
            <div className="grid grid-cols-4 gap-2 px-4 py-3 text-xs font-mono uppercase text-muted-foreground border-b border-border/40">
              <div className="col-span-1">Model</div>
              <div className="text-right">Input</div>
              <div className="text-right">Output</div>
              <div className="text-right hidden sm:block">Use case</div>
            </div>
            {CLAUDE_MODELS.map((m) => (
              <div key={m.name} className="grid grid-cols-4 gap-2 px-4 py-4 border-b border-border/40 last:border-0">
                <div className="font-semibold col-span-1">{m.name}</div>
                <div className="text-right font-mono">${m.input}</div>
                <div className="text-right font-mono">${m.output}</div>
                <div className="text-right hidden sm:block text-sm text-muted-foreground">{m.use}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <h2 className="text-2xl font-display font-bold mb-4">Reálné příklady měsíčních nákladů</h2>
        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          <Card><CardContent className="p-5">
            <div className="text-xs font-mono text-muted-foreground uppercase mb-1">Chatbot · 10k req/měsíc</div>
            <div className="text-2xl font-display font-bold gradient-text mb-1">$72</div>
            <div className="text-sm text-muted-foreground">Sonnet 4, 800 in / 400 out</div>
          </CardContent></Card>
          <Card><CardContent className="p-5">
            <div className="text-xs font-mono text-muted-foreground uppercase mb-1">Klasifikátor · 100k req</div>
            <div className="text-2xl font-display font-bold gradient-text mb-1">$24</div>
            <div className="text-sm text-muted-foreground">Haiku 4, 500 in / 50 out</div>
          </CardContent></Card>
          <Card><CardContent className="p-5">
            <div className="text-xs font-mono text-muted-foreground uppercase mb-1">Coding agent · 1k req</div>
            <div className="text-2xl font-display font-bold gradient-text mb-1">$255</div>
            <div className="text-sm text-muted-foreground">Sonnet 4, 8k in / 4k out</div>
          </CardContent></Card>
        </div>

        <h2 className="text-2xl font-display font-bold mb-4">3 způsoby, jak Claude API náklady osekat</h2>
        <ul className="space-y-3 mb-6">
          {[
            { text: "Použij Haiku pro klasifikaci, routing a krátké odpovědi. Sonnet nech jen tam, kde reálně potřebuješ kvalitu.", link: "/blog/ai-cost-saving", linkText: "Model routing detailně" },
            { text: "Zapni prompt caching — opakovaný systémový prompt může ušetřit 50–90 % vstupních nákladů.", link: "/blog/ai-cost-saving", linkText: "Prompt caching taktiky" },
            { text: "Nastav max_tokens. Většina odpovědí nepotřebuje 4k tokenů; horní strop výrazně sníží output cost.", link: "/blog/prompt-optimization", linkText: "Optimalizace promptů" },
          ].map((t, i) => (
            <li key={i} className="flex gap-3">
              <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p>{t.text}</p>
                <Link to={t.link} className="text-xs text-primary hover:underline">{t.linkText} →</Link>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground mb-10">
          Srovnej s <Link to="/gpt-api-cost" className="text-primary hover:underline">GPT API cost</Link> nebo si všechno přehledně spočítej v <Link to="/llm-cost-calculator" className="text-primary hover:underline">kalkulačce</Link>.
        </p>

        <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20 mb-10">
          <CardContent className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <Zap className="h-6 w-6 text-primary shrink-0 mt-1" />
              <div>
                <h3 className="font-display font-bold text-xl mb-1">Od odhadu k reálným číslům</h3>
                <p className="text-muted-foreground text-sm">
                  Kalkulačka ti dá odhad. Tokeny Monitor ti ukáže, co Claude API skutečně utratil — den po dni, model po modelu, v USD i CZK.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild><Link to="/llm-cost-calculator">Spustit kalkulačku</Link></Button>
              <Button asChild variant="outline"><Link to="/auth">Sledovat skutečné náklady <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            </div>
          </CardContent>
        </Card>

        <h2 className="text-2xl font-display font-bold mb-4">FAQ</h2>
        <div className="space-y-3">
          <Card><CardContent className="p-5">
            <h3 className="font-semibold mb-1">Je Claude dražší než GPT?</h3>
            <p className="text-sm text-muted-foreground">Sonnet je o něco dražší než GPT-4o na vstupu, ale srovnatelný na výstupu. Haiku je levnější než GPT-4o mini na vstupu, ale dražší na výstupu.</p>
          </CardContent></Card>
          <Card><CardContent className="p-5">
            <h3 className="font-semibold mb-1">Účtuje Anthropic za cached tokeny?</h3>
            <p className="text-sm text-muted-foreground">Ano, ale výrazně levněji (typicky 10 % normální ceny vstupu) a zápis do cache stojí 25 % navíc jednou.</p>
          </CardContent></Card>
          <Card><CardContent className="p-5">
            <h3 className="font-semibold mb-1">Kde najdu svůj reálný spend?</h3>
            <p className="text-sm text-muted-foreground">V Anthropic console nebo přímo v Tokeny Monitoru po připojení API klíče — uvidíš den, model i request count.</p>
          </CardContent></Card>
        </div>
      </article>

      <footer className="border-t border-border/40 py-8 text-center text-sm text-muted-foreground">
        <p>Ceny odpovídají publikovaným sazbám Anthropic ke květnu 2026.</p>
        <p className="mt-1">© {new Date().getFullYear()} <Link to="/" className="hover:text-foreground">Tokeny Monitor</Link></p>
      </footer>
    </div>
  );
}
