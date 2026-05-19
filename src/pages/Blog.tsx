import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, BookOpen, Calendar } from "lucide-react";

const POSTS = [
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

      <footer className="border-t border-border/40 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} <Link to="/" className="hover:text-foreground">Tokeny Monitor</Link>
      </footer>
    </div>
  );
}
