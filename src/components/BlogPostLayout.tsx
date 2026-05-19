import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Calendar } from "lucide-react";
import { ReactNode } from "react";

interface BlogPostLayoutProps {
  title: string;
  description: string;
  slug: string;
  date: string;
  tag: string;
  keywords: string;
  children: ReactNode;
}

export default function BlogPostLayout({ title, description, slug, date, tag, keywords, children }: BlogPostLayoutProps) {
  const url = `https://tokeny.pohl.uk/blog/${slug}`;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>{title} | Tokeny Monitor</title>
        <meta name="description" content={description} />
        <meta name="keywords" content={keywords} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="article" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: title,
          description,
          author: { "@type": "Person", name: "Martin Pohl", url: "https://martin.pohl.uk" },
          datePublished: date,
          url,
        })}</script>
      </Helmet>

      <header className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="font-display font-bold text-lg gradient-text">Tokeny Monitor</Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/blog">Blog</Link></Button>
            <Button asChild size="sm"><Link to="/auth">Začít zdarma <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
          </div>
        </div>
      </header>

      <article className="container mx-auto px-4 py-12 max-w-3xl">
        <Link to="/blog" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3 w-3" /> Zpět na blog
        </Link>
        <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground mb-4">
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">{tag}</span>
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {date}</span>
        </div>
        <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight mb-6">{title}</h1>
        <p className="text-lg text-muted-foreground mb-10">{description}</p>

        <div className="prose prose-invert max-w-none
          prose-headings:font-display prose-headings:font-bold prose-headings:tracking-tight
          prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4
          prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
          prose-p:text-foreground/90 prose-p:leading-relaxed
          prose-a:text-primary prose-a:no-underline hover:prose-a:underline
          prose-strong:text-foreground
          prose-li:text-foreground/90 prose-li:my-1
          prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none">
          {children}
        </div>

        <div className="mt-16 p-6 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 text-center">
          <h3 className="text-xl font-display font-bold mb-2">Sleduj reálné AI náklady, ne jen odhady</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Tokeny Monitor ti ukáže denní spend napříč GPT, Claude a Gemini — v USD i CZK.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild><Link to="/auth">Začít zdarma <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            <Button asChild variant="outline"><Link to="/llm-cost-calculator">Otevřít kalkulačku</Link></Button>
          </div>
        </div>
      </article>

      <footer className="border-t border-border/40 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} <Link to="/" className="hover:text-foreground">Tokeny Monitor</Link>
      </footer>
    </div>
  );
}
