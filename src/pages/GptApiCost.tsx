import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Check, DollarSign, TrendingDown, Zap } from "lucide-react";

const GPT_MODELS = [
  { name: "GPT-4o mini", input: 0.15, output: 0.6, use: "Vysoký objem, klasifikace, levný chat" },
  { name: "GPT-4o", input: 2.5, output: 10, use: "Většina produkčních úloh, multimodal" },
  { name: "GPT-5 mini", input: 0.25, output: 2, use: "Lehký reasoning, dobrá cena/výkon" },
  { name: "GPT-5", input: 1.25, output: 10, use: "Komplexní reasoning, agenti, coding" },
];

const EXAMPLES = [
  { title: "Support chatbot", model: "GPT-4o mini", reqs: "100k requestů, 600 in / 300 out", monthly: 27 },
  { title: "Document summarizer", model: "GPT-4o", reqs: "10k requestů, 3000 in / 500 out", monthly: 125 },
  { title: "Coding agent", model: "GPT-5", reqs: "20k requestů, 4000 in / 1500 out", monthly: 400 },
];

export default function GptApiCost() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>GPT API Cost 2026 — OpenAI Pricing per Token & Examples | Tokeny Monitor</title>
        <meta
          name="description"
          content="GPT API cost breakdown for GPT-5, GPT-4o and GPT-4o mini. Per-token pricing, real monthly examples and how to track actual OpenAI spend."
        />
        <meta name="keywords" content="gpt api cost, openai api cost, gpt-4o pricing, gpt-5 pricing, openai pricing, chatgpt api cost, gpt token cost" />
        <link rel="canonical" href="https://tokeny.pohl.uk/gpt-api-cost" />
        <meta property="og:title" content="GPT API Cost 2026 — Full OpenAI Pricing Breakdown" />
        <meta property="og:description" content="How much does the GPT API really cost? GPT-5, GPT-4o, mini pricing with real-world monthly examples." />
        <meta property="og:url" content="https://tokeny.pohl.uk/gpt-api-cost" />
        <meta property="og:type" content="article" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "GPT API Cost 2026 — Full OpenAI Pricing Breakdown",
          description: "Per-token pricing for GPT-5, GPT-4o and mini variants with monthly cost examples.",
          author: { "@type": "Person", name: "Martin Pohl", url: "https://martin.pohl.uk" },
          datePublished: "2026-05-19",
          url: "https://tokeny.pohl.uk/gpt-api-cost",
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            { "@type": "Question", name: "How much does the GPT API cost?",
              acceptedAnswer: { "@type": "Answer", text: "GPT-4o mini costs $0.15/1M input and $0.60/1M output tokens. GPT-4o is $2.50/$10. GPT-5 is $1.25/$10 per million tokens." } },
            { "@type": "Question", name: "Which GPT model is cheapest?",
              acceptedAnswer: { "@type": "Answer", text: "GPT-4o mini is by far the cheapest OpenAI model — roughly 17× cheaper than GPT-4o on input and 8× on output." } },
            { "@type": "Question", name: "How do I track real GPT API spend?",
              acceptedAnswer: { "@type": "Answer", text: "Connect your OpenAI API key in Tokeny Monitor. The dashboard pulls usage from the OpenAI Admin API and shows daily cost in USD or CZK." } },
            { "@type": "Question", name: "Is GPT-5 worth the price over GPT-4o?",
              acceptedAnswer: { "@type": "Answer", text: "For pure chat GPT-4o is often enough. For complex reasoning, multi-step agents and coding, GPT-5 wins on quality per dollar." } },
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

      <section className="container mx-auto px-4 pt-16 pb-10 text-center max-w-4xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-mono mb-6">
          <DollarSign className="h-3 w-3" /> Aktualizováno květen 2026
        </div>
        <h1 className="text-4xl md:text-6xl font-display font-bold tracking-tight mb-6">
          GPT API Cost — kolik <span className="gradient-text">opravdu stojí OpenAI</span>
        </h1>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          Kompletní rozpis cen GPT-5, GPT-4o a GPT-4o mini. Per-token sazby, reálné měsíční příklady
          a jak sledovat skutečné náklady místo odhadu.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg"><Link to="/llm-cost-calculator">Spočítat své náklady <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/auth">Sledovat reálné výdaje</Link></Button>
        </div>
      </section>

      <section className="container mx-auto px-4 py-10 max-w-5xl">
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-6 flex items-center gap-2">
          <Zap className="h-7 w-7 text-primary" /> Ceník GPT modelů (per 1M tokens)
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {GPT_MODELS.map((m) => (
            <Card key={m.name}>
              <CardContent className="p-5">
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="text-xl font-semibold">{m.name}</h3>
                  <div className="text-xs text-muted-foreground font-mono">OpenAI</div>
                </div>
                <div className="flex gap-4 mb-3 text-sm">
                  <div><span className="text-muted-foreground">Input:</span> <strong>${m.input}/1M</strong></div>
                  <div><span className="text-muted-foreground">Output:</span> <strong>${m.output}/1M</strong></div>
                </div>
                <p className="text-sm text-muted-foreground">{m.use}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 py-10 max-w-5xl">
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-6 flex items-center gap-2">
          <TrendingDown className="h-7 w-7 text-primary" /> Reálné měsíční příklady
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {EXAMPLES.map((e) => (
            <Card key={e.title}>
              <CardContent className="p-5">
                <h3 className="font-semibold mb-1">{e.title}</h3>
                <div className="text-xs text-muted-foreground font-mono mb-3">{e.model} · {e.reqs}</div>
                <div className="text-3xl font-display font-bold gradient-text">${e.monthly}<span className="text-base text-muted-foreground">/měs</span></div>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-sm text-muted-foreground mt-4">
          Přesný odhad pro váš workload spočítáte v{" "}
          <Link to="/llm-cost-calculator" className="text-primary hover:underline">LLM cost kalkulačce</Link>.
        </p>
      </section>

      <section className="container mx-auto px-4 py-10 max-w-3xl">
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-6 flex items-center gap-2">
          <Check className="h-7 w-7 text-primary" /> Jak ušetřit na GPT API
        </h2>
        <div className="space-y-3">
          {[
            "Routujte jednoduché dotazy na GPT-4o mini, complex jen na GPT-5.",
            "Používejte prompt caching — opakovaný system prompt může být až 90% levnější.",
            "Zkracujte system prompty a few-shot příklady — input tokeny rychle narostou.",
            "Nastavte max_tokens — model jinak rád generuje delší odpovědi než potřebujete.",
            "Sledujte denní spend — bez monitoringu nezachytíte runaway loop nebo bug v promptu.",
          ].map((t) => (
            <div key={t} className="flex gap-3 items-start">
              <Check className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <p>{t}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 py-10 max-w-3xl">
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-6">FAQ</h2>
        <div className="space-y-4">
          {[
            { q: "Kolik stojí GPT API?", a: "GPT-4o mini stojí $0.15 za 1M input tokenů a $0.60 za 1M output. GPT-4o je $2.50/$10. GPT-5 je $1.25/$10." },
            { q: "Který GPT model je nejlevnější?", a: "GPT-4o mini je zdaleka nejlevnější — asi 17× levnější než GPT-4o na inputu." },
            { q: "Jak sleduju skutečné náklady?", a: "Připojte OpenAI API klíč v Tokeny Monitor. Dashboard tahá data z OpenAI Admin API a ukazuje denní cost v USD nebo CZK." },
            { q: "Vyplatí se GPT-5 oproti GPT-4o?", a: "Pro běžný chat často stačí GPT-4o. Pro reasoning, multi-step agenty a coding vede GPT-5 v poměru kvalita/cena." },
          ].map((f) => (
            <Card key={f.q}><CardContent className="p-5">
              <h3 className="font-semibold mb-2">{f.q}</h3>
              <p className="text-sm text-muted-foreground">{f.a}</p>
            </CardContent></Card>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 py-16 text-center max-w-2xl">
        <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
          Od ceníku k <span className="gradient-text">reálným výdajům</span>
        </h2>
        <p className="text-muted-foreground mb-8">
          Ceník je jen půlka příběhu. Tokeny Monitor ukáže, kolik reálně utrácíte den po dni.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg"><Link to="/auth">Začít zdarma <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/llm-cost-calculator">Otevřít kalkulačku</Link></Button>
        </div>
        <div className="mt-8 text-sm text-muted-foreground">
          Související: <Link to="/claude-api-cost" className="text-primary hover:underline">Claude API cost</Link> ·{" "}
          <Link to="/how-to-calculate-llm-cost" className="text-primary hover:underline">Jak spočítat LLM cost</Link> ·{" "}
          <Link to="/blog" className="text-primary hover:underline">Blog</Link>
        </div>
      </section>

      <footer className="border-t border-border/40 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} <Link to="/" className="hover:text-foreground">Tokeny Monitor</Link>
      </footer>
    </div>
  );
}
