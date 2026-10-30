import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { PublicHeader } from "@/components/PublicHeader";

/**
 * Privacy policy (Czech + English on one prerendered page, so both are indexable and nothing
 * changes on hydration). Describes what the code in this repo actually stores and sends.
 * TODO(martin): confirm the items marked in the PR (IČO, contact e-mail, Supabase region,
 * transfer mechanisms, retention of e-mail logs) before relying on this page.
 */

const UPDATED = { cs: "30. 10. 2026", en: "30 October 2026" };
const OPERATOR_NAME = "Bc. Martin Pohl";
/** TODO(martin): IČO of the sole proprietorship. Shown only when set. */
const OPERATOR_ICO: string | null = null;
/** TODO(martin): a contact e-mail for privacy requests. Shown only when set. */
const CONTACT_EMAIL: string | null = null;
const CONTACT_WEB = "https://martin.pohl.uk";

type Block = { h: string; p?: string[]; ul?: string[] };
type Copy = { title: string; intro: string; updated: string; blocks: Block[] };

const contactCs = [
  CONTACT_EMAIL ? `e-mail ${CONTACT_EMAIL}` : null,
  `web ${CONTACT_WEB.replace("https://", "")}`,
].filter(Boolean).join(", ");
const contactEn = [
  CONTACT_EMAIL ? `e-mail ${CONTACT_EMAIL}` : null,
  `website ${CONTACT_WEB.replace("https://", "")}`,
].filter(Boolean).join(", ");

const CS: Copy = {
  title: "Ochrana osobních údajů",
  updated: `Poslední aktualizace: ${UPDATED.cs}`,
  intro:
    "Tokeny (tokeny.martinpohl.cz a aplikace Tokeny pro iPhone, Mac a Apple Watch) ukazují, kolik utrácíte za AI API. Tady je přesně popsané, jaké údaje k tomu potřebujeme, kde jsou uložené a komu je předáváme.",
  blocks: [
    {
      h: "1. Kdo údaje zpracovává",
      p: [
        `Správcem je ${OPERATOR_NAME}, fyzická osoba podnikající (OSVČ), Praha${OPERATOR_ICO ? `, IČO ${OPERATOR_ICO}` : ""}.`,
        `Kontakt pro všechny dotazy k osobním údajům: ${contactCs}.`,
      ],
    },
    {
      h: "2. Jaké údaje ukládáme",
      ul: [
        "Účet: e-mail, ID uživatele a údaje o přihlášení (heslo ukládá Supabase Auth pouze jako hash). Při přihlášení přes Google nebo Apple dostaneme od nich e-mail a identifikátor účtu; u Apple to může být anonymní přeposílací adresa.",
        "Profil: zobrazované jméno a odkaz na avatar, pokud je vyplníte.",
        "API klíče poskytovatelů (OpenRouter, Anthropic, OpenAI), které sami připojíte. Ukládáme je v databázi na serveru; prohlížeč ani aplikace je zpět nedostanou (vidíte jen zkrácený náhled). Nejsou šifrované zvlášť aplikací, chrání je přístupová práva databáze a šifrování úložiště u Supabase. Doporučujeme připojovat klíče jen s oprávněním ke čtení nákladů, kde to poskytovatel umožňuje.",
        "Údaje o využití AI, které stáhneme od poskytovatelů pomocí vašich klíčů: čas, model, poskytovatel, počty tokenů, cena, doba generování, název aplikace a název API klíče u poskytovatele. Neukládáme obsah vašich promptů ani odpovědí.",
        "Nastavení: měsíční rozpočet, práh upozornění a případně e-mail pro upozornění.",
        "Tokeny pro MCP server (ukládáme jen jejich hash) a sdílené odkazy na dashboard, pokud je vytvoříte.",
        "Předplatné Pro: ID zákazníka a předplatného ve Stripe, stav a období předplatného. Údaje o platební kartě zadáváte přímo u Stripe, k nám se nedostanou.",
        "Záznamy o odeslaných e-mailech (adresa příjemce, typ zprávy, stav doručení), abychom neposílali duplicity a respektovali odhlášení.",
        "Technické záznamy hostingu a serverových funkcí (např. IP adresa, čas a adresa požadavku), které vedou poskytovatelé infrastruktury.",
      ],
    },
    {
      h: "3. Proč a na jakém základě",
      ul: [
        "Poskytování služby, o kterou jste požádali: účet, synchronizace nákladů, dashboard, upozornění, aplikace a widgety (plnění smlouvy, čl. 6 odst. 1 písm. b GDPR).",
        "Placení a vedení účetnictví u předplatného Pro (plnění smlouvy a právní povinnost, čl. 6 odst. 1 písm. b a c GDPR).",
        "Bezpečnost a ochrana proti zneužití, např. technické záznamy a omezení počtu požadavků (oprávněný zájem, čl. 6 odst. 1 písm. f GDPR).",
      ],
      p: ["Nepoužíváme reklamní ani analytické sledovací nástroje třetích stran a údaje neprodáváme."],
    },
    {
      h: "4. Komu údaje předáváme",
      p: ["Jen zpracovatelům, bez kterých služba nefunguje:"],
      ul: [
        "Supabase: databáze, přihlášení a serverové funkce.",
        "Vercel: hosting webu.",
        "Stripe: platby předplatného Pro.",
        "Resend: odesílání e-mailů (potvrzení účtu, obnova hesla).",
        "Anthropic: AI asistent v dashboardu (funkce Pro). Odesíláme mu vaše zprávy asistentovi a souhrny vašich nákladů potřebné k odpovědi. Používá se jen tehdy, když asistentovi napíšete.",
        "Google a Apple: jen pokud se přes ně přihlásíte.",
        "OpenRouter, Anthropic a OpenAI: voláme jejich API s vaším klíčem, abychom stáhli vaše náklady. Nic dalšího jim neposíláme.",
        "Aplikace pro Apple Watch dostává data přímo z vašeho iPhonu, ne z našeho serveru.",
      ],
    },
    {
      h: "5. Kde jsou údaje uložené",
      p: [
        "Databáze běží u Supabase. Někteří z uvedených poskytovatelů (např. Vercel, Stripe, Resend, Anthropic) mohou údaje zpracovávat i v USA. V takovém případě se předání opírá o standardní smluvní doložky EU nebo o rámec EU–USA pro ochranu osobních údajů, které tito poskytovatelé nabízejí.",
      ],
    },
    {
      h: "6. Jak dlouho",
      ul: [
        "Účet, klíče, údaje o využití a nastavení uchováváme, dokud účet nezrušíte. Bezplatný tarif v přehledu zobrazuje posledních 30 dní.",
        "Údaje o platbách uchováváme po dobu, kterou vyžadují účetní a daňové předpisy.",
        "Technické záznamy uchovávají poskytovatelé infrastruktury po omezenou dobu podle svých pravidel.",
      ],
    },
    {
      h: "7. Zrušení účtu",
      p: [
        "Účet zrušíte v Nastavení na webu nebo v aplikaci pro iPhone či Mac. Smažeme tím účet, profil, připojené klíče, údaje o využití, nastavení upozornění, MCP tokeny a sdílené odkazy. Pokud máte předplatné Pro, zrušení účtu ho ve Stripe okamžitě ukončí, bez dalších plateb a bez vrácení peněz za zbývající část období. Faktury a záznamy o platbách zůstávají u Stripe po dobu, kterou vyžadují účetní a daňové předpisy.",
      ],
    },
    {
      h: "8. Úložiště v prohlížeči a v zařízení",
      p: [
        "Web nepoužívá reklamní ani analytické cookies. V úložišti prohlížeče (localStorage) si pamatuje přihlášení, jazyk, vzhled, měnu a poslední kurz ČNB. Aplikace pro Apple ukládají přihlášení v Klíčence a poslední přehled ve sdíleném úložišti aplikace, aby mohly fungovat widgety a Apple Watch. Kurzy měn stahujeme od České národní banky; žádné osobní údaje jí neposíláme.",
      ],
    },
    {
      h: "9. Vaše práva",
      p: [
        `Máte právo na přístup ke svým údajům, jejich opravu, výmaz, omezení zpracování, přenositelnost a právo vznést námitku. Stačí nám napsat (${contactCs}). Máte také právo podat stížnost u Úřadu pro ochranu osobních údajů (uoou.gov.cz).`,
      ],
    },
    {
      h: "10. Změny",
      p: ["Když se zpracování změní, aktualizujeme tuto stránku a datum nahoře. Podstatné změny oznámíme e-mailem nebo na webu."],
    },
  ],
};

const EN: Copy = {
  title: "Privacy policy",
  updated: `Last updated: ${UPDATED.en}`,
  intro:
    "Tokeny (tokeny.martinpohl.cz and the Tokeny apps for iPhone, Mac and Apple Watch) shows how much you spend on AI APIs. This page explains exactly which data that takes, where it is stored and who it is shared with.",
  blocks: [
    {
      h: "1. Who is responsible",
      p: [
        `The controller is ${OPERATOR_NAME}, a sole trader (OSVČ) based in Prague, Czech Republic${OPERATOR_ICO ? `, company ID (IČO) ${OPERATOR_ICO}` : ""}.`,
        `Contact for anything about your personal data: ${contactEn}.`,
      ],
    },
    {
      h: "2. What we store",
      ul: [
        "Account: e-mail, user ID and sign-in data (Supabase Auth stores passwords only as a hash). If you sign in with Google or Apple, we receive your e-mail and account identifier from them; with Apple this can be a private relay address.",
        "Profile: display name and avatar link, if you set them.",
        "Provider API keys (OpenRouter, Anthropic, OpenAI) that you connect. They are stored in the database on the server; neither the browser nor the apps can read them back (you only see a short preview). They are not separately encrypted by the app; they are protected by database access rules and Supabase's storage encryption. Where the provider allows it, connect a key that can only read usage and costs.",
        "AI usage data we fetch from your providers with your keys: time, model, provider, token counts, cost, generation time, app name and the key's name at the provider. We do not store the content of your prompts or responses.",
        "Settings: monthly budget, alert threshold and, optionally, an e-mail address for alerts.",
        "MCP server tokens (only their hash is stored) and shared dashboard links, if you create them.",
        "Pro subscription: Stripe customer and subscription IDs, status and billing period. You enter card details directly with Stripe; they never reach us.",
        "A log of e-mails sent (recipient address, message type, delivery status), so we do not send duplicates and respect unsubscribes.",
        "Technical logs kept by our hosting and server-function providers (for example IP address, time and requested URL).",
      ],
    },
    {
      h: "3. Why, and the legal basis",
      ul: [
        "To provide the service you asked for: account, cost sync, dashboard, alerts, apps and widgets (contract, Art. 6(1)(b) GDPR).",
        "Payments and bookkeeping for Pro (contract and legal obligation, Art. 6(1)(b) and (c) GDPR).",
        "Security and abuse prevention, such as technical logs and rate limits (legitimate interest, Art. 6(1)(f) GDPR).",
      ],
      p: ["We use no third-party advertising or analytics trackers, and we do not sell data."],
    },
    {
      h: "4. Who we share data with",
      p: ["Only with processors the service cannot run without:"],
      ul: [
        "Supabase: database, authentication and server functions.",
        "Vercel: website hosting.",
        "Stripe: Pro subscription payments.",
        "Resend: sending e-mails (account confirmation, password reset).",
        "Anthropic: the AI assistant in the dashboard (a Pro feature). It receives your messages to the assistant and the cost summaries needed to answer. Used only when you write to the assistant.",
        "Google and Apple: only if you sign in with them.",
        "OpenRouter, Anthropic and OpenAI: we call their APIs with your key to fetch your costs. We send them nothing else.",
        "The Apple Watch app gets its data directly from your iPhone, not from our server.",
      ],
    },
    {
      h: "5. Where data is stored",
      p: [
        "The database runs on Supabase. Some of the providers above (for example Vercel, Stripe, Resend and Anthropic) may also process data in the USA. Such transfers rely on the EU Standard Contractual Clauses or the EU–US Data Privacy Framework offered by those providers.",
      ],
    },
    {
      h: "6. How long",
      ul: [
        "Account, keys, usage data and settings are kept until you delete your account. The free plan shows the last 30 days.",
        "Payment records are kept for as long as accounting and tax law requires.",
        "Technical logs are kept by the infrastructure providers for a limited time under their own policies.",
      ],
    },
    {
      h: "7. Deleting your account",
      p: [
        "Delete your account in Settings on the web or in the iPhone or Mac app. This deletes the account, profile, connected keys, usage data, alert settings, MCP tokens and shared links. If you have Pro, deleting the account cancels it in Stripe immediately: no further charges and no refund for the rest of the period. Invoices and payment records stay with Stripe for as long as accounting and tax law requires.",
      ],
    },
    {
      h: "8. Browser and device storage",
      p: [
        "The website uses no advertising or analytics cookies. Browser storage (localStorage) keeps your session, language, appearance, currency and the last Czech National Bank exchange rate. The Apple apps keep your session in the Keychain and the last summary in the app's shared container so widgets and Apple Watch work. Exchange rates come from the Czech National Bank; we send it no personal data.",
      ],
    },
    {
      h: "9. Your rights",
      p: [
        `You have the right to access, correct and erase your data, to restrict processing, to data portability and to object. Just write to us (${contactEn}). You can also lodge a complaint with the Czech Office for Personal Data Protection (uoou.gov.cz) or your local supervisory authority.`,
      ],
    },
    {
      h: "10. Changes",
      p: ["When processing changes, we update this page and the date at the top. Significant changes will be announced by e-mail or on the website."],
    },
  ],
};

function Section({ copy, lang }: { copy: Copy; lang: "cs" | "en" }) {
  return (
    <section lang={lang} id={lang} className="scroll-mt-20">
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">{copy.title}</h1>
      <p className="text-sm text-muted-foreground mb-6">{copy.updated}</p>
      <p className="text-[17px] leading-relaxed mb-8">{copy.intro}</p>
      {copy.blocks.map((b) => (
        <div key={b.h} className="mb-8">
          <h2 className="text-xl font-semibold tracking-tight mb-3">{b.h}</h2>
          {b.p?.map((t) => (
            <p key={t} className="leading-relaxed text-muted-foreground mb-3">{t}</p>
          ))}
          {b.ul && (
            <ul className="list-disc pl-5 space-y-2 leading-relaxed text-muted-foreground">
              {b.ul.map((t) => <li key={t}>{t}</li>)}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Ochrana osobních údajů / Privacy policy | Tokeny</title>
        <meta
          name="description"
          content="Jaké údaje Tokeny ukládají, proč, kde a komu je předávají. What Tokeny stores, why, where and who it is shared with."
        />
        <link rel="canonical" href="https://tokeny.martinpohl.cz/privacy" />
        <meta property="og:url" content="https://tokeny.martinpohl.cz/privacy" />
        <meta property="og:type" content="website" />
      </Helmet>

      <PublicHeader />

      <article className="container mx-auto px-4 py-16 max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs">
            <ShieldCheck className="h-3 w-3" aria-hidden /> GDPR
          </div>
          <nav aria-label="Language" className="text-sm flex gap-3">
            <a href="#cs" className="text-primary hover:underline">Česky</a>
            <a href="#en" className="text-primary hover:underline">English</a>
          </nav>
        </div>

        <Section copy={CS} lang="cs" />
        <hr className="my-14 border-border" />
        <Section copy={EN} lang="en" />
      </article>

      <footer className="border-t border-border/40 py-8 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} <Link to="/" className="hover:text-foreground">Tokeny</Link></p>
      </footer>
    </div>
  );
}
