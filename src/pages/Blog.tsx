import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, BookOpen, Calendar } from "lucide-react";

const POSTS = [
  {
    slug: "grok-token-optimization",
    title: "Jak optimalizovat tokeny u Grok API (xAI): 7 praktických tipů",
    excerpt: "Kratší výstupy, správa historie, prompt caching, výběr modelu a měření. Jak snížit účet za Grok.",
    date: "2026-10-07",
    tag: "Cost optimization",
  },
  {
    slug: "multi-provider-monitoring",
    title: "Multi-provider monitoring: 7 AI providerů v jednom dashboardu",
    excerpt: "OpenRouter, Anthropic, OpenAI, Gemini, Mistral, Groq a xAI (Grok) v jednom přehledu. Proč to dává smysl a jak začít.",
    date: "2026-06-30",
    tag: "Product update",
  },
  {
    slug: "ai-cost-saving",
    title: "10 způsobů, jak ušetřit na AI API nákladech v roce 2026",
    excerpt: "Praktický playbook pro snížení LLM nákladů o 40–80 % bez ztráty kvality. Caching, routing, batch API a další taktiky.",
    date: "2026-05-19",
    tag: "Cost optimization",
  },
  {
    slug: "prompt-optimization",
    title: "Optimalizace promptů: jak zkrátit tokeny a zlepšit výsledky",
    excerpt: "Konkrétní techniky — od strukturovaných promptů přes few-shot pruning po prompt compression. S příklady před/po.",
    date: "2026-05-19",
    tag: "Prompt engineering",
  },
  {
    slug: "token-window",
    title: "Token window: jak pracovat s dlouhým kontextem chytře",
    excerpt: "Sliding window, RAG, summary chains a context pruning. Kdy se vyplatí 1M context a kdy je to drahý overkill.",
    date: "2026-05-19",
    tag: "Context management",
  },
  {
    slug: "gpt-vs-claude-vs-gemini",
    title: "GPT-5 vs Claude vs Gemini: srovnání 2026 (cena, rychlost, kvalita)",
    excerpt: "Přímé srovnání flagship modelů — ceny per 1M tokenů, context window, silné a slabé stránky. Kdy který zvolit.",
    date: "2026-05-25",
    tag: "Model comparison",
  },
  {
    slug: "monitoring-ai-costs",
    title: "Monitoring AI nákladů: co měřit, jaké alerty nastavit a proč",
    excerpt: "5 KPI, smysluplné alerty, red flagy v dashboardu a setup za 10 minut. FinOps pro LLM API.",
    date: "2026-05-25",
    tag: "Monitoring & FinOps",
  },
];

export default function Blog() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Blog — AI cost saving, prompt engineering & token optimization | Tokeny Monitor</title>
        <meta name="description" content="Praktické články o snižování nákladů na LLM, optimalizaci promptů a práci s token window. Návody, příklady, čísla." />
        <link rel="canonical" href="https://tokeny.pohl.uk/blog" />
        <meta property="og:title" content="Tokeny Monitor Blog — AI cost & prompt optimization" />
        <meta property="og:description" content="Návody a tipy jak ušetřit na AI API a psát lepší prompty." />
        <meta property="og:url" content="https://tokeny.pohl.uk/blog" />
        <meta property="og:type" content="website" />
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

      <section className="container mx-auto px-4 pt-16 pb-10 max-w-4xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-mono mb-6">
          <BookOpen className="h-3 w-3" /> Blog
        </div>
        <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-4">
          <span className="gradient-text">AI cost saving</span> & prompt optimization
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Praktické články o tom, jak snížit náklady na LLM API, psát efektivnější prompty a chytře pracovat s token window.
        </p>
      </section>

      <section className="container mx-auto px-4 pb-16 max-w-4xl">
        <div className="grid gap-4">
          {POSTS.map((p) => (
            <Link to={`/blog/${p.slug}`} key={p.slug} className="block group">
              <Card className="transition-colors hover:border-primary/50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground mb-3">
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">{p.tag}</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {p.date}</span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-display font-bold mb-2 group-hover:text-primary transition-colors">
                    {p.title}
                  </h2>
                  <p className="text-muted-foreground">{p.excerpt}</p>
                  <div className="mt-4 text-sm text-primary flex items-center gap-1">
                    Číst článek <ArrowRight className="h-3 w-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 pb-16 max-w-4xl">
        <h2 className="text-xl font-display font-bold mb-4">Nástroje a ceníky</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <Link to="/llm-cost-calculator" className="block group">
            <Card className="transition-colors hover:border-primary/50">
              <CardContent className="p-5">
                <h3 className="font-semibold group-hover:text-primary transition-colors mb-1">LLM Cost Calculator</h3>
                <p className="text-sm text-muted-foreground">Odhad nákladů na 11 modelů napříč providery</p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/gpt-api-cost" className="block group">
            <Card className="transition-colors hover:border-primary/50">
              <CardContent className="p-5">
                <h3 className="font-semibold group-hover:text-primary transition-colors mb-1">GPT API cost</h3>
                <p className="text-sm text-muted-foreground">Per-token ceník GPT-5, GPT-4o, mini</p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/claude-api-cost" className="block group">
            <Card className="transition-colors hover:border-primary/50">
              <CardContent className="p-5">
                <h3 className="font-semibold group-hover:text-primary transition-colors mb-1">Claude API cost</h3>
                <p className="text-sm text-muted-foreground">Haiku, Sonnet, Opus pricing & příklady</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border/40 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} <Link to="/" className="hover:text-foreground">Tokeny Monitor</Link>
      </footer>
    </div>
  );
}
