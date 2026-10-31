import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, BookOpen, Calculator, Calendar, FileText } from "lucide-react";
import { ReactNode } from "react";
import ShareButtons from "@/components/ShareButtons";
import { PublicHeader } from "@/components/PublicHeader";

interface BlogPostLayoutProps {
  title: string;
  description: string;
  slug: string;
  date: string;
  /** Human-readable date shown on the page (defaults to the ISO date). */
  dateLabel?: string;
  tag: string;
  keywords: string;
  children: ReactNode;
}

export default function BlogPostLayout({ title, description, slug, date, dateLabel, tag, keywords, children }: BlogPostLayoutProps) {
  const url = `https://tokeny.martinpohl.cz/blog/${slug}`;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>{title} | Tokeny</title>
        <meta name="description" content={description} />
        <meta name="keywords" content={keywords} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="article" />
        <meta property="og:locale" content="cs_CZ" />
        <meta property="article:published_time" content={date} />
        <meta property="article:author" content="Martin Pohl" />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: title,
          description,
          author: { "@type": "Person", name: "Martin Pohl", url: "https://martinpohl.cz" },
          publisher: {
            "@type": "Organization",
            name: "Tokeny",
            logo: { "@type": "ImageObject", url: "https://tokeny.martinpohl.cz/icon-512.png" },
          },
          datePublished: date,
          dateModified: date,
          inLanguage: "cs-CZ",
          image: "https://tokeny.martinpohl.cz/og-image.png",
          mainEntityOfPage: { "@type": "WebPage", "@id": url },
          url,
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Domů", item: "https://tokeny.martinpohl.cz/" },
            { "@type": "ListItem", position: 2, name: "Blog", item: "https://tokeny.martinpohl.cz/blog" },
            { "@type": "ListItem", position: 3, name: title, item: url },
          ],
        })}</script>

      </Helmet>

      <PublicHeader />

      <article className="container mx-auto px-4 py-12 max-w-3xl">
        <Link to="/blog" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3 w-3" /> Zpět na blog
        </Link>
        <div className="flex items-center gap-3 text-xs tabular-nums text-muted-foreground mb-4">
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">{tag}</span>
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> <time dateTime={date}>{dateLabel ?? date}</time></span>
          <span>Martin Pohl</span>
        </div>
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">{title}</h1>
        <p className="text-lg text-muted-foreground mb-6">{description}</p>
        <div className="mb-10"><ShareButtons url={url} title={title} /></div>

        <div className="prose prose-invert max-w-none
          prose-headings:prose-headings:font-bold prose-headings:tracking-tight
          prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4
          prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
          prose-p:text-foreground/90 prose-p:leading-relaxed
          prose-a:text-primary prose-a:no-underline hover:prose-a:underline
          prose-strong:text-foreground
          prose-li:text-foreground/90 prose-li:my-1
          prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none">
          {children}
        </div>

        <div className="mt-12">
          <h3 className="text-lg font-bold mb-4">Související návody a ceníky</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="group hover:border-primary/50 transition-colors">
              <CardContent className="p-4">
                <Calculator className="h-4 w-4 text-primary mb-2" />
                <Link to="/llm-cost-calculator" className="text-sm font-semibold group-hover:text-primary transition-colors block">LLM Cost Calculator</Link>
                <p className="text-xs text-muted-foreground mt-1">Odhad nákladů na 11 modelů</p>
              </CardContent>
            </Card>
            <Card className="group hover:border-primary/50 transition-colors">
              <CardContent className="p-4">
                <FileText className="h-4 w-4 text-primary mb-2" />
                <Link to="/gpt-api-cost" className="text-sm font-semibold group-hover:text-primary transition-colors block">GPT API cost</Link>
                <p className="text-xs text-muted-foreground mt-1">Per-token ceník OpenAI modelů</p>
              </CardContent>
            </Card>
            <Card className="group hover:border-primary/50 transition-colors">
              <CardContent className="p-4">
                <FileText className="h-4 w-4 text-primary mb-2" />
                <Link to="/claude-api-cost" className="text-sm font-semibold group-hover:text-primary transition-colors block">Claude API cost</Link>
                <p className="text-xs text-muted-foreground mt-1">Haiku, Sonnet, Opus pricing</p>
              </CardContent>
            </Card>
            <Card className="group hover:border-primary/50 transition-colors">
              <CardContent className="p-4">
                <FileText className="h-4 w-4 text-primary mb-2" />
                <Link to="/how-to-calculate-llm-cost" className="text-sm font-semibold group-hover:text-primary transition-colors block">Jak spočítat LLM cost</Link>
                <p className="text-xs text-muted-foreground mt-1">Krok za krokem — vzorec a tipy</p>
              </CardContent>
            </Card>
          </div>
          <div className="grid sm:grid-cols-3 gap-3 mt-3">
            <Card className="group hover:border-primary/50 transition-colors">
              <CardContent className="p-4">
                <BookOpen className="h-4 w-4 text-primary mb-2" />
                <Link to="/blog/ai-cost-saving" className="text-sm font-semibold group-hover:text-primary transition-colors block">10 způsobů úspor</Link>
                <p className="text-xs text-muted-foreground mt-1">Caching, routing, batch API</p>
              </CardContent>
            </Card>
            <Card className="group hover:border-primary/50 transition-colors">
              <CardContent className="p-4">
                <BookOpen className="h-4 w-4 text-primary mb-2" />
                <Link to="/blog/prompt-optimization" className="text-sm font-semibold group-hover:text-primary transition-colors block">Optimalizace promptů</Link>
                <p className="text-xs text-muted-foreground mt-1">Zkrátit tokeny o 30–60 %</p>
              </CardContent>
            </Card>
            <Card className="group hover:border-primary/50 transition-colors">
              <CardContent className="p-4">
                <BookOpen className="h-4 w-4 text-primary mb-2" />
                <Link to="/blog/token-window" className="text-sm font-semibold group-hover:text-primary transition-colors block">Token window strategie</Link>
                <p className="text-xs text-muted-foreground mt-1">RAG, sliding window, pruning</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-10 p-6 rounded-xl bg-primary/5 border border-primary/20 text-center">
          <h3 className="text-xl font-bold mb-2">Sleduj reálné AI náklady, ne jen odhady</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Tokeny ti ukáže denní spend napříč GPT, Claude a Gemini — v USD i CZK.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild><Link to="/auth">Začít zdarma <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            <Button asChild variant="outline"><Link to="/llm-cost-calculator">Otevřít kalkulačku</Link></Button>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border/40 flex justify-center">
          <ShareButtons url={url} title={title} />
        </div>
      </article>


      <footer className="border-t border-border/40 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} <Link to="/" className="hover:text-foreground">Tokeny</Link>
      </footer>
    </div>
  );
}
