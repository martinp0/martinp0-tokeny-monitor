import { useRef } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Upload,
  DollarSign,
  Zap,
  Shield,
  Sparkles,
  LineChart,
  Globe,
  CheckCircle2,
  Smartphone,
  ExternalLink,
  Heart,
  Coffee,
  Github,
} from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useCurrency } from "@/hooks/useCurrency";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { CostTimeChart } from "@/components/dashboard/CostTimeChart";
import { TokensChart } from "@/components/dashboard/TokensChart";
import { ModelCostChart } from "@/components/dashboard/ModelCostChart";
import { ProviderChart } from "@/components/dashboard/ProviderChart";
import { SpeedChart } from "@/components/dashboard/SpeedChart";
import { RequestsTable } from "@/components/dashboard/RequestsTable";
import { useAuth } from "@/hooks/useAuth";

const FEATURES = [
  {
    icon: DollarSign,
    title: "Náklady v CZK i USD",
    desc: "Přepínej měnu jedním klikem. Aktuální kurz ČNB se stahuje automaticky.",
    color: "from-[hsl(270,95%,65%)] to-[hsl(320,90%,65%)]",
  },
  {
    icon: BarChart3,
    title: "Detailní grafy",
    desc: "Spotřeba tokenů, výkon modelů, latence, providery — vše na jednom místě.",
    color: "from-[hsl(175,85%,55%)] to-[hsl(200,90%,60%)]",
  },
  {
    icon: Upload,
    title: "Import z CSV",
    desc: "Stáhni si activity export z OpenRouter a nahraj ho jedním tažením myši.",
    color: "from-[hsl(45,100%,60%)] to-[hsl(320,90%,65%)]",
  },
  {
    icon: Zap,
    title: "Real-life srovnání",
    desc: "Kolik espress, piv nebo pizz by se za tvoje API náklady dalo koupit?",
    color: "from-[hsl(140,80%,55%)] to-[hsl(175,85%,55%)]",
  },
  {
    icon: Shield,
    title: "Bezpečné a privátní",
    desc: "Tvoje data zůstávají v šifrovaném cloudu, viditelná jen tobě.",
    color: "from-[hsl(270,95%,65%)] to-[hsl(200,90%,60%)]",
  },
  {
    icon: Smartphone,
    title: "Funguje všude",
    desc: "Web, mobil, tablet i jako nativní app pro iOS a Android.",
    color: "from-[hsl(320,90%,65%)] to-[hsl(45,100%,60%)]",
  },
];

const FAQS = [
  {
    q: "Jak importuju CSV z OpenRouteru?",
    a: "Přihlas se na openrouter.ai, otevři stránku Activity a klikni na Export → CSV. Stažený soubor pak v Tokeny Monitoru přetáhneš do uploaderu na dashboardu (nebo klikneš a vybereš). Parser automaticky rozpozná všechny sloupce — modely, providery, tokeny, latenci i cenu v USD. Můžeš nahrávat opakovaně, duplicity se přeskakují podle ID requestu.",
  },
  {
    q: "Proč není automatická synchronizace s OpenRouter API?",
    a: "OpenRouter zatím nenabízí veřejné API pro historii activity — dostupný je jen real-time generation endpoint. Jakmile veřejné API spustí, doplníme auto-sync. Do té doby je CSV import nejspolehlivější cesta a trvá ~10 vteřin.",
  },
  {
    q: "Jak převádíte tokeny a USD na CZK?",
    a: "Náklady přicházejí v USD (tak je vrací OpenRouter). V dashboardu si jedním klikem přepneš zobrazení mezi USD a CZK. Kurz tahá automatický CRON job z oficiálního API České národní banky (denně), takže máš vždy aktuální oficiální devizový kurz. Konverze se počítá per-request, ne paušálně, aby seděla na den, kdy request proběhl.",
  },
  {
    q: "Jak funguje zabezpečení dat?",
    a: "Tvoje data leží v šifrované databázi (Postgres + AES-256 at rest, TLS in transit). Každý řádek má vazbu na tvoje user_id a Row-Level Security politiky garantují, že vidíš a upravuješ jen vlastní data — i kdyby někdo získal API klíč, RLS to zablokuje na úrovni databáze. Zápisy do databáze jdou výhradně přes ověřené Edge Functions s service-role klíčem, nikdy přímo z prohlížeče.",
  },
  {
    q: "Stojí to něco? Je tam nějaký freemium / limit?",
    a: "Aktuálně zdarma. Žádná kreditka, žádný trial. Cílem je být užitečný nástroj pro indie devs a malé týmy — pokud v budoucnu přijde placený tier (např. týmové sdílení, pokročilé alerty), free plan zůstane.",
  },
  {
    q: "Co to je MCP server a k čemu mi je?",
    a: "MCP (Model Context Protocol) je standard od Anthropicu, kterým si AI klient (Claude Desktop, Cursor, Zed…) může připojit externí nástroje. Tokeny Monitor exposuje MCP endpoint s nástroji jako get_total_cost, get_top_models nebo delete_request. V /settings si vygeneruješ token, vložíš do konfigurace klienta a můžeš se Claudea ptát „kolik jsem utratil za Sonnet minulý týden?“ přímo v chatu.",
  },
];

export default function Landing() {
  const { session } = useAuth();
  const { t } = useTranslation();
  const dashRef = useRef<HTMLDivElement>(null);
  const {
    filteredData, selectedModel, setSelectedModel,
    totalCost, totalRequests, totalTokens, avgGenTime,
    costByModel, costByProvider, timeSeries,
  } = useDashboardData({ demoMode: true });
  const { currency, toggle: toggleCurrency, exchangeRate } = useCurrency();

  const ctaHref = session ? "/dashboard" : "/auth";
  const ctaLabel = session ? t("nav.openDashboard") : t("nav.startFree");

  return (
    <div className="min-h-screen bg-background bg-mesh text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] glass">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Activity className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold gradient-text tracking-tight">OpenRouter Monitor</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-mono text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">{t("nav.features")}</a>
            <a href="#demo" className="hover:text-foreground transition-colors">{t("nav.demo")}</a>
            <a href="#how" className="hover:text-foreground transition-colors">{t("nav.howItWorks")}</a>
            <a href="#faq" className="hover:text-foreground transition-colors">{t("nav.faq")}</a>
          </nav>
          <div className="flex items-center gap-2">
            <a
              href="https://buymeacoffee.com/martinpohlp"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-gradient-to-r from-[hsl(35,100%,60%)]/20 to-[hsl(20,90%,55%)]/20 border border-[hsl(35,100%,60%)]/30 text-[hsl(35,100%,70%)] text-xs font-mono hover:from-[hsl(35,100%,60%)]/30 hover:to-[hsl(20,90%,55%)]/30 transition-all"
            >
              <Coffee className="h-3 w-3" />
              Buy me a coffee
            </a>
            <LanguageSwitcher />
            {!session && (
              <Link to="/auth">
                <Button variant="ghost" size="sm" className="font-mono text-xs hidden sm:inline-flex">
                  {t("nav.login")}
                </Button>
              </Link>
            )}
            <Link to={ctaHref}>
              <Button
                size="sm"
                className="gap-1.5 font-mono text-xs bg-gradient-to-r from-primary to-[hsl(320,90%,65%)] hover:opacity-90 transition-opacity border-0"
              >
                {ctaLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative px-6 pt-20 pb-16 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass border-white/[0.08] text-xs font-mono text-muted-foreground mb-8 animate-fade-in">
          <Sparkles className="h-3 w-3 text-accent" />
          Přehled nákladů AI tokenů v reálném čase
        </div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-6">
          Zjisti, kolik tě <br className="hidden md:block" />
          <span className="gradient-text">opravdu stojí AI</span>
        </h1>
        <p className="max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground mb-10 font-mono">
          Krásný dashboard pro tvoji OpenRouter aktivitu. Sleduj spotřebu, optimalizuj
          modely a převáděj náklady do <span className="text-accent">CZK i USD</span>.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4">
          <Link to={ctaHref}>
            <Button
              size="lg"
              className="gap-2 font-mono bg-gradient-to-r from-primary to-[hsl(320,90%,65%)] hover:opacity-90 transition-opacity border-0 glow-md"
            >
              {ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <a href="#demo">
            <Button size="lg" variant="outline" className="gap-2 font-mono glass glass-hover border-white/[0.08]">
              <LineChart className="h-4 w-4" />
              Vyzkoušet demo
            </Button>
          </a>
        </div>
        <div className="flex items-center justify-center gap-5 text-xs font-mono text-muted-foreground">
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-accent" />Zdarma</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-accent" />Bez instalace</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-accent" />CZ rozhraní</span>
        </div>
        <div className="mt-6 flex flex-col items-center gap-2">
          <a
            href="https://buymeacoffee.com/martinpohlp"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[hsl(35,100%,60%)]/20 to-[hsl(20,90%,55%)]/20 border border-[hsl(35,100%,60%)]/30 text-[hsl(35,100%,70%)] text-sm font-mono hover:from-[hsl(35,100%,60%)]/30 hover:to-[hsl(20,90%,55%)]/30 hover:border-[hsl(35,100%,60%)]/50 transition-all group"
          >
            <Coffee className="h-4 w-4 group-hover:scale-110 transition-transform" />
            Líbí se ti to? Kup mi kafe ☕
            <Heart className="h-3 w-3 opacity-60 group-hover:opacity-100 transition-opacity" />
          </a>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-20 max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Vše, co potřebuješ pro <span className="gradient-text">kontrolu AI nákladů</span>
          </h2>
          <p className="text-muted-foreground font-mono max-w-2xl mx-auto">
            Žádné tabulky v Excelu. Žádné dohady. Jen čisté grafy a přehledná čísla.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc, color }, i) => (
            <Card
              key={title}
              className="glass glass-hover relative overflow-hidden group animate-fade-in opacity-0"
              style={{ animationDelay: `${i * 80}ms`, animationFillMode: "forwards" }}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-[0.08] transition-opacity duration-500`} />
              <CardContent className="p-6 relative">
                <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center mb-4`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-bold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Live Demo */}
      <section id="demo" className="px-6 py-20 max-w-[1600px] mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/15 text-accent text-xs font-mono mb-4">
            <Activity className="h-3 w-3" />
            Live demo s ukázkovými daty
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Takhle to <span className="gradient-text">vypadá uvnitř</span>
          </h2>
          <p className="text-muted-foreground font-mono max-w-2xl mx-auto mb-6">
            Žádný login, žádná registrace. Hraj si s grafy hned teď.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleCurrency}
            className="gap-1.5 border-border hover:bg-secondary hover:text-foreground font-mono text-xs"
          >
            Přepnout do {currency === "CZK" ? "USD ($)" : "CZK (Kč)"}
          </Button>
        </div>

        <div ref={dashRef} className="space-y-4 rounded-2xl glass border-white/[0.08] p-4 md:p-6 glow-sm">
          <KpiCards
            totalCost={totalCost}
            totalRequests={totalRequests}
            totalTokens={totalTokens}
            avgGenTime={avgGenTime}
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CostTimeChart data={timeSeries} />
            <TokensChart data={timeSeries} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ModelCostChart data={costByModel} onModelClick={setSelectedModel} selectedModel={selectedModel} />
            <ProviderChart data={costByProvider} />
            <SpeedChart data={timeSeries} />
          </div>
          <RequestsTable data={filteredData} />
        </div>

        <div className="mt-10 text-center">
          <p className="text-sm text-muted-foreground font-mono mb-4">
            Líbí se ti to? Nahraj svoje vlastní data a sleduj <span className="text-accent">opravdové náklady</span>.
          </p>
          <Link to={ctaHref}>
            <Button
              size="lg"
              className="gap-2 font-mono bg-gradient-to-r from-primary to-[hsl(320,90%,65%)] hover:opacity-90 transition-opacity border-0 glow-md"
            >
              {ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="px-6 py-20 max-w-5xl mx-auto">
        <h2 className="text-3xl md:text-5xl font-bold mb-12 text-center">
          3 kroky k <span className="gradient-text">dokonalému přehledu</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { n: "01", t: "Vytvoř si účet", d: "Registrace přes email nebo Google. Trvá to 10 vteřin." },
            { n: "02", t: "Nahraj CSV", d: "Stáhni activity export z openrouter.ai/activity a nahraj." },
            { n: "03", t: "Sleduj a optimalizuj", d: "Filtry podle modelů, datumů a providerů. Export do PNG/PDF." },
          ].map(({ n, t, d }) => (
            <Card key={n} className="glass border-white/[0.08]">
              <CardContent className="p-6">
                <div className="text-5xl font-mono font-bold gradient-text mb-3">{n}</div>
                <h3 className="text-lg font-bold mb-2">{t}</h3>
                <p className="text-sm text-muted-foreground">{d}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="px-6 py-20 max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-mono mb-4">
            <Sparkles className="h-3 w-3" />
            Nejčastější dotazy
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Co lidi <span className="gradient-text">nejvíc zajímá</span>
          </h2>
          <p className="text-muted-foreground font-mono">
            Krátké odpovědi na otázky, které dostávám pořád.
          </p>
        </div>
        <Accordion type="single" collapsible className="space-y-3">
          {FAQS.map((item, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className="glass border-white/[0.08] rounded-xl px-5 data-[state=open]:glow-sm transition-shadow"
            >
              <AccordionTrigger className="text-left font-bold hover:no-underline py-5">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-5">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Maker — nenápadné propojení s martin.pohl.uk */}
      <section id="maker" className="px-6 py-16 max-w-5xl mx-auto">
        <a
          href="https://martin.pohl.uk?utm_source=tokeny.pohl.uk&utm_medium=landing&utm_campaign=maker_card"
          target="_blank"
          rel="noopener author"
          className="block group"
        >
          <Card className="glass glass-hover border-white/[0.08] overflow-hidden">
            <CardContent className="p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-10">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary via-[hsl(320,90%,65%)] to-accent flex items-center justify-center text-xl font-bold text-white shrink-0 glow-sm">
                  MP
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-1">
                    Indie maker
                  </div>
                  <div className="text-lg font-bold">Martin Pohl</div>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                  Tokeny Monitor staví <span className="text-foreground font-medium">Martin</span> —
                  IT engineer za <span className="text-foreground">Apple MDM, Identity & SSO</span> rolloutsy
                  a indie web projekty. Mrkni na jeho práci a další experimenty.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm font-mono text-accent group-hover:gap-3 transition-all shrink-0">
                martin.pohl.uk
                <ExternalLink className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        </a>
      </section>

      {/* Support — Buy Me a Coffee */}
      <section className="px-6 py-12 max-w-3xl mx-auto text-center">
        <div className="glass rounded-2xl border-[hsl(35,100%,60%)]/20 p-8 md:p-10 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[hsl(35,100%,60%)]/5 via-transparent to-[hsl(20,90%,55%)]/5 pointer-events-none" />
          <div className="absolute -top-10 -right-10 h-32 w-32 bg-[hsl(35,100%,60%)]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[hsl(35,100%,60%)] to-[hsl(20,90%,55%)] flex items-center justify-center mx-auto mb-5 shadow-lg shadow-[hsl(35,100%,60%)]/20">
              <Coffee className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-xl md:text-2xl font-bold mb-3">
              Podpoř vývoj <span className="gradient-text">kávou</span>
            </h3>
            <p className="text-sm text-muted-foreground font-mono max-w-lg mx-auto mb-6 leading-relaxed">
              Tokeny Monitor je zdarma a open-source. Pokud ti šetří čas nebo peníze, můžeš
              poděkovat symbolickým kafem. Každá podpora motivuje k dalšímu vylepšování. 💜
            </p>
            <a
              href="https://buymeacoffee.com/martinpohlp"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                size="lg"
                className="gap-2 font-mono bg-gradient-to-r from-[hsl(35,100%,60%)] to-[hsl(20,90%,55%)] hover:opacity-90 transition-opacity border-0 text-white shadow-lg shadow-[hsl(35,100%,60%)]/25 hover:shadow-[hsl(35,100%,60%)]/40"
              >
                <Heart className="h-4 w-4" />
                Buy Me a Coffee
                <ExternalLink className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Open Source */}
      <section className="px-6 py-12 max-w-3xl mx-auto text-center">
        <div className="glass rounded-2xl border-white/[0.08] p-8 md:p-10 flex flex-col items-center">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[hsl(0,0%,20%)] to-[hsl(0,0%,40%)] flex items-center justify-center mb-5">
            <Github className="h-6 w-6 text-white" />
          </div>
          <h3 className="text-xl md:text-2xl font-bold mb-3">
            100 % <span className="gradient-text">open-source</span>
          </h3>
          <p className="text-sm text-muted-foreground font-mono max-w-lg mx-auto mb-6 leading-relaxed">
            Celý kód je veřejný na GitHubu. Forkni si repo, rozjeď lokálně přes Docker
            a uprav si dashboard podle sebe. Pull requesty vítány!
          </p>
          <a
            href="https://github.com/martinp0/martinp0-tokeny-monitor"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              size="lg"
              className="gap-2 font-mono glass glass-hover border-white/[0.08]"
              variant="outline"
            >
              <Github className="h-4 w-4" />
              Zobrazit na GitHubu
              <ExternalLink className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </a>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-24 max-w-4xl mx-auto text-center">
        <div className="rounded-3xl glass border-white/[0.08] p-12 glow-md relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 pointer-events-none" />
          <Globe className="h-12 w-12 text-accent mx-auto mb-6 relative" />
          <h2 className="text-3xl md:text-5xl font-bold mb-4 relative">
            Připraven/a převzít <span className="gradient-text">kontrolu nad AI náklady?</span>
          </h2>
          <p className="text-muted-foreground font-mono mb-8 relative">
            Začni během minuty. Žádná kreditka.
          </p>
          <div className="relative">
            <Link to={ctaHref}>
              <Button
                size="lg"
                className="gap-2 font-mono bg-gradient-to-r from-primary to-[hsl(320,90%,65%)] hover:opacity-90 transition-opacity border-0"
              >
                {ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] px-6 py-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-mono text-muted-foreground">
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5" />
            <span>
              OpenRouter Monitor · {new Date().getFullYear()} · crafted by{" "}
              <a
                href="https://martin.pohl.uk?utm_source=tokeny.pohl.uk&utm_medium=footer"
                target="_blank"
                rel="noopener author"
                className="text-foreground hover:text-accent transition-colors underline-offset-4 hover:underline"
              >
                Martin Pohl
              </a>
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="https://buymeacoffee.com/martinpohlp"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[hsl(35,100%,70%)] transition-colors flex items-center gap-1.5 px-2 py-1 rounded-full bg-[hsl(35,100%,60%)]/10 border border-[hsl(35,100%,60%)]/20"
            >
              <Coffee className="h-3 w-3 text-[hsl(35,100%,70%)]" />
              <span className="text-[hsl(35,100%,70%)]">Support</span>
            </a>
            <a
              href="https://martin.pohl.uk?utm_source=tokeny.pohl.uk&utm_medium=footer_nav"
              target="_blank"
              rel="noopener author"
              className="hover:text-foreground transition-colors"
            >
              martin.pohl.uk
            </a>
            <Link to="/auth" className="hover:text-foreground transition-colors">Přihlášení</Link>
            <a
              href="https://github.com/martinp0/martinp0-tokeny-monitor"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors flex items-center gap-1"
            >
              <Github className="h-3 w-3" />
              GitHub
            </a>
            <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">OpenRouter</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
