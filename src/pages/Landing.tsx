import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LandingDemoGate } from "@/components/landing/LandingDemoGate";
import { PricingSection } from "@/components/landing/PricingSection";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bell,
  Coffee,
  Github,
  Lock,
  Plug,
  Coins,
  Smartphone,
  TrendingUp,
  MessagesSquare,
} from "lucide-react";
import { useCurrency } from "@/hooks/useCurrency";
import { SITE_URL } from "@/config/site";
import { maybeSignedIn } from "@/lib/auth-client";
import SupportCard from "@/components/SupportCard";


const FEATURES = [
  { key: "currency", icon: Coins },
  { key: "charts", icon: BarChart3 },
  { key: "providers", icon: Plug },
  { key: "alerts", icon: Bell },
  { key: "anomalies", icon: TrendingUp },
  { key: "mcp", icon: MessagesSquare },
  { key: "privacy", icon: Lock },
  { key: "everywhere", icon: Smartphone },
] as const;

type FaqItem = { q: string; a: string };

export default function Landing() {
  const { t } = useTranslation();
  const { currency, toggle: toggleCurrency } = useCurrency();
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    // Optimistic CTA: the hint is set by the auth client; /dashboard re-checks the real session.
    setHasSession(maybeSignedIn());
  }, []);

  const ctaHref = hasSession ? "/dashboard" : "/auth";
  const ctaLabel = hasSession ? t("nav.openDashboard") : t("landing.hero.primary");
  const faq = t("landing.faq.items", { returnObjects: true }) as FaqItem[];
  const faqList = Array.isArray(faq) ? faq : [];

  return (
    <div className="min-h-screen max-w-full bg-background text-foreground">
      <Helmet>
        <title>{t("landing.metaTitle")}</title>
        <meta name="description" content={t("landing.metaDesc")} />
        <link rel="canonical" href={`${SITE_URL}/`} />
        <meta property="og:title" content={t("landing.metaTitle")} />
        <meta property="og:description" content={t("landing.metaDesc")} />
        <meta property="og:url" content={`${SITE_URL}/`} />
        <link rel="alternate" hrefLang="cs" href={`${SITE_URL}/`} />
        <link rel="alternate" hrefLang="en" href={`${SITE_URL}/?lang=en`} />
        <link rel="alternate" hrefLang="x-default" href={`${SITE_URL}/`} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Tokeny",
          url: `${SITE_URL}/`,
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          description: t("landing.metaDesc"),
          offers: { "@type": "Offer", price: "0", priceCurrency: "CZK" },
          author: { "@type": "Person", name: "Martin Pohl", url: "https://martinpohl.cz" },
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqList.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        })}</script>
      </Helmet>

      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-card focus:px-4 focus:py-2">
        {t("landing.nav.skip")}
      </a>

      <header className="sticky top-0 z-50 glass-bar pt-safe">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2 min-w-0">
          <Link to="/" className="tap-target flex items-center gap-2 min-w-0" aria-label="Tokeny">
            <span className="h-7 w-7 shrink-0 rounded-lg bg-primary-fill flex items-center justify-center">
              <Activity className="h-4 w-4 text-white" aria-hidden />
            </span>
            <span className="text-[17px] font-semibold tracking-tight">Tokeny</span>
          </Link>
          <nav aria-label="Primary" className="hidden md:flex items-center gap-1 text-sm text-muted-foreground">
            {(["features", "demo", "pricing", "faq"] as const).map((k) => (
              <a key={k} href={`#${k}`} className="tap-target inline-flex items-center px-3 rounded-full hover:text-foreground transition-colors">
                {t(`landing.nav.${k}`)}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-0.5 shrink-0">
            <ThemeToggle />
            <LanguageSwitcher className="px-2" />
            {!hasSession && (
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link to="/auth">{t("nav.login")}</Link>
              </Button>
            )}
            <Button asChild size="sm" className="ml-1">
              <Link to={ctaHref}>{hasSession ? t("nav.openDashboard") : t("nav.startFree")}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="px-4 sm:px-6 pt-16 pb-12 md:pt-28 md:pb-20 max-w-4xl mx-auto text-center">
          <p className="eyebrow mb-5 animate-fade-in">{t("landing.hero.eyebrow")}</p>
          <h1 className="text-[2.75rem] leading-[1.05] sm:text-6xl md:text-7xl font-semibold tracking-[-0.03em] mb-6">
            {t("landing.hero.title1")}{" "}
            <br className="hidden sm:block" />
            <span className="text-muted-foreground">{t("landing.hero.title2")}</span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground leading-relaxed mb-10">
            {t("landing.hero.subtitle")}
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 max-w-sm sm:max-w-none mx-auto">
            <Button asChild size="lg" className="gap-2">
              <Link to={ctaHref}>
                {ctaLabel}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#demo">{t("landing.hero.secondary")}</a>
            </Button>
          </div>
          <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {(["trust1", "trust2", "trust3"] as const).map((k) => (
              <li key={k} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
                {t(`landing.hero.${k}`)}
              </li>
            ))}
          </ul>
        </section>

        {/* Demo */}
        <section id="demo" className="scroll-mt-20 px-3 sm:px-6 pb-20 md:pb-28 max-w-6xl mx-auto">
          <div className="text-center mb-8 px-1">
            <p className="eyebrow mb-3">{t("landing.demo.eyebrow")}</p>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-4">{t("landing.demo.title")}</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-6">{t("landing.demo.subtitle")}</p>
            <Button variant="outline" size="sm" onClick={toggleCurrency}>
              {t("landing.demo.switchTo", { currency: currency === "CZK" ? "USD ($)" : "CZK (Kč)" })}
            </Button>
          </div>
          <div className="rounded-[28px] bg-card shadow-[0_1px_2px_hsl(0_0%_0%/0.04),0_24px_60px_-20px_hsl(0_0%_0%/0.18)] ring-1 ring-border overflow-hidden">
            <div className="flex items-center gap-1.5 px-4 h-10 border-b border-border" aria-hidden>
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
              <span className="ml-3 text-xs text-muted-foreground truncate">tokeny.martinpohl.cz/dashboard</span>
            </div>
            <div className="p-3 sm:p-5 md:p-6 bg-background">
              <LandingDemoGate />
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 px-4 sm:px-6 py-20 md:py-28 bg-card border-y border-border">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <p className="eyebrow mb-3">{t("landing.features.eyebrow")}</p>
              <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">{t("landing.features.title")}</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10">
              {FEATURES.map(({ key, icon: Icon }) => (
                <div key={key}>
                  <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="text-[17px] font-semibold mb-1.5">{t(`landing.features.items.${key}.title`)}</h3>
                  <p className="text-[15px] text-muted-foreground leading-relaxed">{t(`landing.features.items.${key}.desc`)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 px-4 sm:px-6 py-20 md:py-28 max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="eyebrow mb-3">{t("landing.how.eyebrow")}</p>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">{t("landing.how.title")}</h2>
          </div>
          <ol className="grid md:grid-cols-3 gap-4 md:gap-6">
            {([1, 2, 3] as const).map((n) => (
              <li key={n} className="surface rounded-3xl p-6 md:p-8">
                <span className="mb-5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary-fill text-white text-sm font-semibold tabular-nums">
                  {n}
                </span>
                <h3 className="text-[17px] font-semibold mb-1.5">{t(`landing.how.s${n}t`)}</h3>
                <p className="text-[15px] text-muted-foreground leading-relaxed">{t(`landing.how.s${n}d`)}</p>
              </li>
            ))}
          </ol>
        </section>

        <PricingSection ctaHref={ctaHref} signedIn={hasSession} />

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 px-4 sm:px-6 py-20 md:py-28 max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="eyebrow mb-3">{t("landing.faq.eyebrow")}</p>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">{t("landing.faq.title")}</h2>
          </div>
          <Accordion type="single" collapsible className="surface rounded-3xl px-5 md:px-8">
            {faqList.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className={i === faqList.length - 1 ? "border-b-0" : "border-border"}>
                <AccordionTrigger className="text-left text-[17px] font-medium hover:no-underline py-5">{f.q}</AccordionTrigger>
                <AccordionContent className="text-[15px] text-muted-foreground leading-relaxed">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* Closing CTA */}
        <section className="px-4 sm:px-6 pb-16 md:pb-20 max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-4">{t("landing.cta.title")}</h2>
          <p className="text-muted-foreground text-lg mb-8">{t("landing.cta.subtitle")}</p>
          <Button asChild size="lg" className="gap-2">
            <Link to={ctaHref}>
              {ctaLabel}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </section>

        <section className="px-4 sm:px-6 pb-20 md:pb-28 max-w-3xl mx-auto">
          <SupportCard placement="landing" />
        </section>
      </main>

      <footer className="border-t border-border bg-card pb-safe">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid gap-10 sm:grid-cols-2 md:grid-cols-4 text-sm">
          <div className="sm:col-span-2 md:col-span-1">
            <Link to="/" className="inline-flex items-center gap-2 mb-3">
              <span className="h-7 w-7 rounded-lg bg-primary-fill flex items-center justify-center">
                <Activity className="h-4 w-4 text-white" aria-hidden />
              </span>
              <span className="text-[17px] font-semibold tracking-tight">Tokeny</span>
            </Link>
            <p className="text-muted-foreground leading-relaxed max-w-xs">{t("landing.maker.desc")}</p>
          </div>
          <FooterCol title={t("landing.footer.product")}>
            <FooterLink to="/llm-cost-calculator">{t("landing.footer.calculator")}</FooterLink>
            <FooterLink href="#pricing">{t("landing.nav.pricing")}</FooterLink>
            <FooterLink to="/auth">{t("landing.footer.login")}</FooterLink>
          </FooterCol>
          <FooterCol title={t("landing.footer.resources")}>
            <FooterLink to="/claude-api-cost">{t("landing.footer.claude")}</FooterLink>
            <FooterLink to="/gpt-api-cost">{t("landing.footer.gpt")}</FooterLink>
            <FooterLink to="/blog">{t("landing.footer.blog")}</FooterLink>
          </FooterCol>
          <FooterCol title={t("landing.footer.about")}>
            <FooterLink href="https://github.com/martinp0/tokeny-monitor" external>
              <Github className="h-4 w-4" aria-hidden /> GitHub
            </FooterLink>
            <FooterLink href="https://martinpohl.cz" external>martinpohl.cz</FooterLink>
            <FooterLink to="/privacy">{t("landing.footer.privacy")}</FooterLink>
            <FooterLink to="/terms">{t("landing.footer.terms")}</FooterLink>
            <FooterLink href="https://buymeacoffee.com/martinp0" external>
              <Coffee className="h-4 w-4" aria-hidden /> {t("landing.footer.coffee")}
            </FooterLink>
          </FooterCol>
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 border-t border-border text-xs text-muted-foreground flex flex-wrap justify-between gap-2">
          <span>© {new Date().getFullYear()} Tokeny · {t("landing.footer.rights")}</span>
          <span>MIT License</span>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

function FooterLink({ to, href, external, children }: { to?: string; href?: string; external?: boolean; children: React.ReactNode }) {
  const cls = "inline-flex items-center gap-2 min-h-[44px] md:min-h-[32px] text-muted-foreground hover:text-foreground transition-colors";
  return (
    <li>
      {to ? (
        <Link to={to} className={cls}>{children}</Link>
      ) : (
        <a href={href} className={cls} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
          {children}
        </a>
      )}
    </li>
  );
}
