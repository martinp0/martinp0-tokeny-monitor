import type { ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { PublicHeader } from "@/components/PublicHeader";
import { csCopy } from "@/lib/cs-typography";
import { PRICING, PRO_TRIAL_DAYS } from "@/config/pricing";

/**
 * Terms of service (obchodní podmínky), Czech + English on one prerendered page like /privacy.
 * Operator facts come from the public ARES record (IČO 17256712, sídlo, not a VAT payer);
 * the contact e-mail is the one published on martinpohl.cz.
 * TODO(martin): have this reviewed by a lawyer; bump TERMS_VERSION in server/lib/billing.ts
 * whenever the terms change materially.
 */

const EFFECTIVE = { cs: "31. 10. 2026", en: "31 October 2026" };
const OPERATOR = "Bc. Martin Pohl";
const ICO = "17256712";
const SEAT = "Hrnčířská 221, Zdiměřice, 252 42 Jesenice";
const EMAIL = "hello@martinpohl.cz";
const MONTHLY = PRICING.pro.monthly;
const YEARLY = PRICING.pro.yearly;

type Block = { h: string; p?: string[]; ul?: string[] };
type Copy = { title: string; intro: string; updated: string; summary: string[]; blocks: Block[] };

const CS: Copy = {
  title: "Obchodní podmínky",
  updated: `Účinné od ${EFFECTIVE.cs}`,
  intro:
    "Tyto obchodní podmínky upravují používání služby Tokeny (web tokeny.martinpohl.cz a aplikace Tokeny) a předplatné Tokeny Pro. Uzavřením smlouvy, tedy registrací účtu nebo objednáním předplatného, s nimi souhlasíš.",
  summary: [
    "Základní tarif je zdarma, Pro stojí 99 Kč měsíčně nebo 990 Kč ročně.",
    "Ceny jsou konečné, provozovatel není plátcem DPH.",
    "Předplatné se automaticky obnovuje, zrušíš ho kdykoli v Nastavení s účinkem ke konci období.",
    "Údaje o nákladech jsou orientační a závisí na API poskytovatelů.",
    "AI funkce běží na tvém vlastním klíči Anthropic, za AI platíš přímo Anthropicu.",
  ],
  blocks: [
    {
      h: "1. Provozovatel",
      p: [
        `Službu provozuje ${OPERATOR}, IČO ${ICO}, se sídlem ${SEAT}, fyzická osoba podnikající podle živnostenského zákona, zapsaná v živnostenském rejstříku vedeném Městským úřadem Černošice. Provozovatel není plátcem DPH.`,
        `Kontakt: e-mail [${EMAIL}](mailto:${EMAIL}), web [martinpohl.cz](https://martinpohl.cz).`,
      ],
    },
    {
      h: "2. Co je Tokeny",
      p: [
        "Tokeny je online služba, která pomocí API klíčů, jež sám připojíš, stahuje od poskytovatelů AI (např. OpenRouter, Anthropic, OpenAI) údaje o využití a nákladech a zobrazuje je v přehledu, grafech, widgetech a dalších funkcích. Jde o digitální službu poskytovanou na dálku; nedodáváme žádné zboží.",
        "AI funkce (AI asistent v tarifu Pro a AI zábava) volají službu Anthropic s tvým vlastním API klíčem Anthropic, který si uložíš v Nastavení. Poplatky za jejich použití platíš přímo Anthropicu podle jeho ceníku a podmínek; nejsou součástí ceny Pro a Tokeny z nich nic nedostává. Bez vlastního klíče AI funkce nefungují. Tvoje dotazy a souhrny dat potřebné k odpovědi se posílají Anthropicu.",
        "Aktuální rozsah funkcí jednotlivých tarifů je popsán v ceníku na webu. Službu průběžně vyvíjíme, funkce proto můžeme měnit, pokud tím podstatně nezhoršíme to, co sis předplatil.",
      ],
    },
    {
      h: "3. Uzavření smlouvy a účet",
      ul: [
        "Smlouva o používání bezplatného tarifu vzniká registrací účtu. Smlouva o předplatném Pro vzniká dokončením objednávky v platební bráně Stripe.",
        "Při registraci uváděj pravdivé údaje a chraň své přihlašovací údaje. Za činnost ve svém účtu odpovídáš ty.",
        "Smlouvu uzavíráme v češtině nebo angličtině. Tyto podmínky jsou trvale dostupné na této stránce; potvrzení objednávky a doklady o platbě dostaneš e-mailem od Stripe.",
        "Pokud službu používáš v rámci podnikání, nejsi spotřebitel a neplatí pro tebe ustanovení určená výhradně spotřebitelům (zejména odstoupení od smlouvy podle čl. 6).",
      ],
    },
    {
      h: "4. Tarify a ceny",
      ul: [
        "Free: zdarma, s omezeními uvedenými v ceníku (např. kratší historie dat).",
        `Pro: ${MONTHLY} Kč měsíčně nebo ${YEARLY} Kč ročně. Poplatky Anthropicu za AI funkce v ceně nejsou (viz čl. 2).`,
        "Všechny ceny jsou konečné. Provozovatel není plátcem DPH, DPH se proto neúčtuje.",
        PRO_TRIAL_DAYS > 0
          ? `Při prvním předplatném nabízíme zkušební období ${PRO_TRIAL_DAYS} dní zdarma. Pokud předplatné před jeho koncem nezrušíš, první platba proběhne automaticky po skončení zkušebního období.`
          : "Pokud je u objednávky nabídnuto zkušební období zdarma, první platba proběhne automaticky po jeho skončení, pokud předplatné předtím nezrušíš.",
        "Případné slevové kódy platí jen podle podmínek uvedených u kódu.",
      ],
    },
    {
      h: "5. Platba, obnovení a zrušení předplatného",
      ul: [
        "Platby zpracovává Stripe. Údaje o platební kartě zadáváš přímo u Stripe, k nám se nedostanou.",
        "Předplatné se platí předem a automaticky se obnovuje na další stejně dlouhé období (měsíc nebo rok), dokud ho nezrušíš.",
        "Zrušit ho můžeš kdykoli v Nastavení (správa předplatného přes zákaznický portál Stripe). Zrušení se projeví ke konci zaplaceného období, do té doby Pro dál funguje. Za nevyčerpanou část období peníze nevracíme, pokud zákon nestanoví jinak (viz čl. 6 a 7).",
        "Když platba neprojde, Stripe ji zkusí zopakovat. Pokud se ji nepodaří uhradit, přejde účet na tarif Free.",
        "Cenu předplatného můžeme změnit. Změnu oznámíme e-mailem nejméně 30 dní předem a projeví se až od dalšího období. Pokud s ní nesouhlasíš, předplatné před tím zrušíš.",
        "Zrušení účtu v Nastavení ukončí předplatné okamžitě, bez dalších plateb.",
      ],
    },
    {
      h: "6. Odstoupení od smlouvy (spotřebitelé)",
      p: [
        "Jako spotřebitel můžeš od smlouvy uzavřené přes internet odstoupit bez udání důvodu do 14 dnů od jejího uzavření (§ 1829 občanského zákoníku). Stačí nám to v této lhůtě oznámit e-mailem; můžeš použít i vzorový formulář podle nařízení vlády č. 363/2013 Sb., není to ale povinné.",
        "Před objednáním Pro výslovně žádáš, abychom službu začali poskytovat hned, ještě před uplynutím lhůty pro odstoupení. Bereš na vědomí, že když potom od smlouvy odstoupíš, zaplatíš poměrnou část ceny za dobu, po kterou ti služba byla poskytována (§ 1834 občanského zákoníku), a že po úplném poskytnutí služby právo na odstoupení zaniká (§ 1837 písm. a) občanského zákoníku). Tento souhlas a datum jeho udělení si ukládáme u objednávky.",
        "Peníze (po odečtení poměrné části) vrátíme do 14 dnů od odstoupení stejným způsobem, jakým jsi platil. Během zkušebního období zdarma se nic neplatí, odstoupením v něm tedy nevzniká žádný nárok na platbu.",
      ],
    },
    {
      h: "7. Reklamace",
      p: [
        "Odpovídáme za to, že služba odpovídá smlouvě a popisu (u digitálních služeb zejména § 2389a a násl. občanského zákoníku). Pokud něco nefunguje, napiš nám na uvedený e-mail, co se stalo a kdy. Reklamaci vyřídíme bez zbytečného odkladu, nejpozději do 30 dnů od jejího uplatnění, a o výsledku tě informujeme e-mailem.",
        "Pokud vadu neodstraníme v přiměřené době nebo jde o podstatné porušení smlouvy, máš podle zákona právo na přiměřenou slevu nebo na odstoupení od smlouvy.",
      ],
    },
    {
      h: "8. Omezení odpovědnosti",
      ul: [
        "Údaje v Tokeny mají informativní charakter. Pocházejí z API poskytovatelů AI, kteří je mohou zpožďovat, měnit, zaokrouhlovat nebo dočasně neposkytovat; přepočty na koruny používají kurz ČNB a mohou se lišit od částky na tvém výpisu. Závazné jsou vždy faktury a přehledy přímo u poskytovatele.",
        "Tokeny není účetní, daňový ani finanční nástroj a neslouží jako jediný podklad pro rozhodnutí o rozpočtu. Rozpočtové alerty jsou pomůcka, ne záruka, že limit nepřekročíš.",
        "Odpovědi AI asistenta a AI zábavy generuje model třetí strany a mohou být nepřesné. Za poplatky, které ti Anthropic účtuje za AI požadavky s tvým klíčem, odpovídáš ty; doporučujeme si v Anthropic Console nastavit limit útraty.",
        "Službu se snažíme provozovat nepřetržitě, ale nezaručujeme její stoprocentní dostupnost. Výpadky a změny na straně poskytovatelů AI, hostingu nebo plateb nemůžeme ovlivnit.",
        "Neodpovídáme za škodu vzniklou nesprávností nebo nedostupností údajů od poskytovatelů ani za ušlý zisk, a to v rozsahu, který zákon připouští. Toto omezení se nevztahuje na škodu způsobenou úmyslně nebo z hrubé nedbalosti, na újmu na zdraví ani na práva spotřebitele, která nelze smluvně omezit.",
      ],
    },
    {
      h: "9. API klíče a tvoje odpovědnost",
      ul: [
        "Připojuj jen klíče, ke kterým máš oprávnění. Doporučujeme klíče jen pro čtení nákladů, kde to poskytovatel umožňuje.",
        "Klíče ukládáme zašifrované a používáme je jen ke stažení údajů o využití. Klíč můžeš kdykoli odebrat v aplikaci a zneplatnit u poskytovatele.",
        "Totéž platí pro tvůj AI klíč Anthropic: ukládáme ho zašifrovaný, zobrazujeme jen poslední 4 znaky a používáme ho jen pro AI požadavky, které sám spustíš. Nikdy ho nepoužijeme pro jiné uživatele.",
        "Za klíče, jejich oprávnění a dodržování podmínek poskytovatelů AI odpovídáš ty. Pokud máš podezření na únik klíče, ihned ho zneplatni u poskytovatele.",
      ],
    },
    {
      h: "10. Pravidla používání",
      p: ["Službu nesmíš používat v rozporu se zákonem nebo tak, aby škodila jiným. Zejména není dovoleno:"],
      ul: [
        "připojovat cizí klíče nebo účty bez svolení jejich držitele,",
        "obcházet zabezpečení, omezení tarifů nebo limity počtu požadavků,",
        "službu přetěžovat, automatizovaně zahlcovat nebo napadat,",
        "přeprodávat přístup k Pro bez naší dohody.",
      ],
    },
    {
      h: "11. Ukončení",
      ul: [
        "Účet můžeš kdykoli zrušit v Nastavení. Tím smažeme tvoje data podle zásad ochrany osobních údajů.",
        "Pokud podstatně porušíš tyto podmínky (např. čl. 10), můžeme ti přístup omezit nebo účet zrušit; pokud to okolnosti dovolí, nejdřív tě na porušení upozorníme e-mailem.",
        "Pokud se rozhodneme službu ukončit úplně, oznámíme to nejméně 30 dní předem a nevyčerpanou část zaplaceného předplatného vrátíme.",
      ],
    },
    {
      h: "12. Ochrana osobních údajů",
      p: ["Jak zpracováváme osobní údaje, popisují [zásady ochrany osobních údajů](/privacy)."],
    },
    {
      h: "13. Mimosoudní řešení sporů a stížnosti",
      p: [
        `Stížnosti a reklamace posílej na ${EMAIL}. Pokud spor nevyřešíme dohodou, můžeš jako spotřebitel podat návrh na mimosoudní řešení sporu u České obchodní inspekce, Ústřední inspektorát – oddělení ADR, Štěpánská 15, 120 00 Praha 2, web [adr.coi.cz](https://adr.coi.cz).`,
        "Evropská platforma pro řešení sporů online (ODR) byla k 20. 7. 2025 zrušena. Při přeshraničním sporu ti poradí Evropské spotřebitelské centrum ČR ([evropskyspotrebitel.cz](https://www.evropskyspotrebitel.cz)).",
        "Dozor nad dodržováním povinností v ochraně spotřebitele vykonává Česká obchodní inspekce ([coi.gov.cz](https://www.coi.gov.cz)), v oblasti živnostenského podnikání příslušný živnostenský úřad.",
      ],
    },
    {
      h: "14. Rozhodné právo a závěrečná ustanovení",
      ul: [
        "Smlouva se řídí právem České republiky, zejména občanským zákoníkem (zákon č. 89/2012 Sb.) a zákonem o ochraně spotřebitele (zákon č. 634/1992 Sb.). Pokud jsi spotřebitel s bydlištěm v jiném státě EU, neztrácíš ochranu, kterou ti dávají kogentní předpisy tvého státu.",
        "Tyto podmínky můžeme z rozumných důvodů změnit (např. změna zákona nebo funkcí). Podstatné změny oznámíme e-mailem nejméně 30 dní předem; pokud nesouhlasíš, můžeš předplatné zrušit a účet smazat.",
        "Smlouvu nijak samostatně neukládáme mimo tvůj účet a záznamy v Stripe; aktuální znění podmínek je vždy na této stránce.",
        `Tyto podmínky jsou účinné od ${EFFECTIVE.cs}.`,
      ],
    },
  ],
};

const EN: Copy = {
  title: "Terms of service",
  updated: `Effective from ${EFFECTIVE.en}`,
  intro:
    "These terms govern the use of Tokeny (the website tokeny.martinpohl.cz and the Tokeny apps) and the Tokeny Pro subscription. By creating an account or ordering a subscription you agree to them. The Czech version above prevails in case of any discrepancy.",
  summary: [
    "The basic plan is free; Pro costs CZK 99 a month or CZK 990 a year.",
    "Prices are final; the provider is not a VAT payer.",
    "Subscriptions renew automatically; cancel any time in Settings, effective at the end of the period.",
    "Cost data is informational and depends on the providers' APIs.",
    "AI features run on your own Anthropic key; you pay Anthropic directly for AI.",
  ],
  blocks: [
    {
      h: "1. Provider",
      p: [
        `Tokeny is operated by ${OPERATOR}, company ID (IČO) ${ICO}, registered at ${SEAT}, Czech Republic, a sole trader registered in the Trade Register kept by the Municipal Office of Černošice. The provider is not a VAT payer.`,
        `Contact: e-mail [${EMAIL}](mailto:${EMAIL}), website [martinpohl.cz](https://martinpohl.cz).`,
      ],
    },
    {
      h: "2. What Tokeny is",
      p: [
        "Tokeny is an online service that uses API keys you connect to fetch usage and cost data from AI providers (such as OpenRouter, Anthropic and OpenAI) and shows it in dashboards, charts, widgets and other features. It is a digital service provided at a distance; no goods are delivered.",
        "The AI features (the AI assistant in Pro and the Fun page) call Anthropic with your own Anthropic API key, which you save in Settings. You pay Anthropic directly for their use under its prices and terms; this is not included in the Pro price and Tokeny receives nothing from it. Without your own key the AI features do not work. Your questions and the data summaries needed to answer are sent to Anthropic.",
        "The current features of each plan are described in the pricing section of the website. We keep developing the service and may change features, as long as we do not materially reduce what you have paid for.",
      ],
    },
    {
      h: "3. Contract and account",
      ul: [
        "The contract for the free plan is concluded when you create an account. The contract for Pro is concluded when you complete the order in the Stripe checkout.",
        "Give accurate details when signing up and keep your credentials safe. You are responsible for activity in your account.",
        "The contract is concluded in Czech or English. These terms are always available on this page; order confirmations and receipts are sent to you by Stripe.",
        "If you use the service for business purposes you are not a consumer, and provisions reserved for consumers (in particular withdrawal under section 6) do not apply to you.",
      ],
    },
    {
      h: "4. Plans and prices",
      ul: [
        "Free: no charge, with the limits shown on the pricing page (for example a shorter data history).",
        `Pro: CZK ${MONTHLY} a month or CZK ${YEARLY} a year. Anthropic's charges for the AI features are not included (see section 2).`,
        "All prices are final. The provider is not a VAT payer, so no VAT is charged.",
        PRO_TRIAL_DAYS > 0
          ? `Your first subscription comes with a free ${PRO_TRIAL_DAYS}-day trial. Unless you cancel before it ends, the first payment is taken automatically when the trial ends.`
          : "If a free trial is offered with the order, the first payment is taken automatically when it ends unless you cancel before.",
        "Promotion codes apply only under the conditions stated with the code.",
      ],
    },
    {
      h: "5. Payment, renewal and cancellation",
      ul: [
        "Payments are processed by Stripe. You enter card details directly with Stripe; they never reach us.",
        "Subscriptions are paid in advance and renew automatically for another period of the same length (month or year) until you cancel.",
        "You can cancel any time in Settings (subscription management through the Stripe customer portal). Cancellation takes effect at the end of the paid period; Pro keeps working until then. We do not refund the unused part of a period unless the law requires it (see sections 6 and 7).",
        "If a payment fails, Stripe retries it. If it cannot be collected, the account moves to the Free plan.",
        "We may change the subscription price. We will tell you by e-mail at least 30 days in advance and the change applies from the next period. If you disagree, cancel before then.",
        "Deleting your account in Settings ends the subscription immediately, with no further charges.",
      ],
    },
    {
      h: "6. Right of withdrawal (consumers)",
      p: [
        "As a consumer you may withdraw from a contract concluded online without giving a reason within 14 days of its conclusion (section 1829 of the Czech Civil Code). Just tell us by e-mail within that period; you may use the model withdrawal form, but you do not have to.",
        "Before ordering Pro you expressly ask us to start providing the service right away, before the withdrawal period ends. You acknowledge that if you then withdraw, you pay a proportionate part of the price for the time the service was provided (section 1834), and that the right of withdrawal ends once the service has been fully provided (section 1837(a)). We store this consent and its time with the order.",
        "We refund the money (less the proportionate part) within 14 days of withdrawal, using the same payment method. Nothing is charged during the free trial, so withdrawing during it costs you nothing.",
      ],
    },
    {
      h: "7. Complaints about defects",
      p: [
        "We are responsible for the service matching the contract and its description (for digital services, in particular sections 2389a et seq. of the Czech Civil Code). If something does not work, e-mail us what happened and when. We handle complaints without undue delay and within 30 days at the latest, and tell you the outcome by e-mail.",
        "If we do not fix a defect within a reasonable time, or the breach is material, you are entitled by law to a reasonable price reduction or to withdraw from the contract.",
      ],
    },
    {
      h: "8. Limitation of liability",
      ul: [
        "Data in Tokeny is informational. It comes from the AI providers' APIs, which may delay, change, round or temporarily withhold it; conversions to CZK use the Czech National Bank rate and may differ from your statement. The provider's own invoices and dashboards are always authoritative.",
        "Tokeny is not an accounting, tax or financial tool and should not be the only basis for budget decisions. Budget alerts are an aid, not a guarantee that you will stay within a limit.",
        "Answers from the AI assistant and the Fun page are generated by a third-party model and may be inaccurate. You are responsible for what Anthropic charges you for AI requests made with your key; we recommend setting a spend limit in the Anthropic Console.",
        "We aim to run the service continuously but do not guarantee 100% availability. We cannot control outages or changes at AI providers, hosting or payment services.",
        "To the extent permitted by law, we are not liable for loss caused by inaccurate or unavailable provider data, or for lost profit. This does not limit liability for intentional harm or gross negligence, harm to health, or consumer rights that cannot be limited by contract.",
      ],
    },
    {
      h: "9. API keys and your responsibility",
      ul: [
        "Only connect keys you are authorised to use. Where the provider allows it, use keys that can only read usage and costs.",
        "We store keys encrypted and use them only to fetch usage data. You can remove a key in the app at any time and revoke it at the provider.",
        "The same applies to your Anthropic AI key: we store it encrypted, show only its last 4 characters and use it only for AI requests you start yourself. It is never used for other users.",
        "You are responsible for your keys, their permissions and for complying with the AI providers' terms. If you suspect a key has leaked, revoke it at the provider straight away.",
      ],
    },
    {
      h: "10. Acceptable use",
      p: ["Do not use the service unlawfully or in a way that harms others. In particular, do not:"],
      ul: [
        "connect someone else's keys or accounts without their permission,",
        "bypass security, plan restrictions or rate limits,",
        "overload, flood or attack the service,",
        "resell access to Pro without our agreement.",
      ],
    },
    {
      h: "11. Termination",
      ul: [
        "You can delete your account any time in Settings; your data is then deleted as described in the privacy policy.",
        "If you materially breach these terms (for example section 10), we may restrict access or close the account; where circumstances allow, we will warn you by e-mail first.",
        "If we decide to shut the service down entirely, we will announce it at least 30 days in advance and refund the unused part of any paid subscription.",
      ],
    },
    {
      h: "12. Personal data",
      p: ["How we process personal data is described in the [privacy policy](/privacy)."],
    },
    {
      h: "13. Out-of-court dispute resolution and complaints",
      p: [
        `Send complaints to ${EMAIL}. If we cannot settle a dispute, as a consumer you can file for out-of-court resolution with the Czech Trade Inspection Authority (Česká obchodní inspekce), ADR department, Štěpánská 15, 120 00 Prague 2, [adr.coi.cz](https://adr.coi.cz).`,
        "The EU Online Dispute Resolution (ODR) platform was discontinued on 20 July 2025. For cross-border disputes, the European Consumer Centre Czech Republic can help ([evropskyspotrebitel.cz](https://www.evropskyspotrebitel.cz)).",
        "Consumer protection is supervised by the Czech Trade Inspection Authority ([coi.gov.cz](https://www.coi.gov.cz)); trade licensing matters by the competent trade licensing office.",
      ],
    },
    {
      h: "14. Governing law and final provisions",
      ul: [
        "The contract is governed by Czech law, in particular the Civil Code (Act No. 89/2012 Coll.) and the Consumer Protection Act (Act No. 634/1992 Coll.). If you are a consumer living in another EU country, you keep the protection given by the mandatory rules of your country.",
        "We may change these terms for good reason (for example a change in the law or in features). We will announce material changes by e-mail at least 30 days in advance; if you disagree, you can cancel the subscription and delete the account.",
        "We do not file the contract separately beyond your account and the Stripe records; the current terms are always on this page.",
        `These terms are effective from ${EFFECTIVE.en}.`,
      ],
    },
  ],
};

const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

/** Render "[label](href)" inside copy as links (internal paths via react-router). */
function rich(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK_RE)) {
    const [all, label, href] = m;
    const i = m.index ?? 0;
    if (i > last) out.push(text.slice(last, i));
    out.push(
      href.startsWith("/") ? (
        <Link key={i} to={href} className="text-primary hover:underline">{label}</Link>
      ) : (
        <a key={i} href={href} className="text-primary hover:underline" {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
          {label}
        </a>
      ),
    );
    last = i + all.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Section({ copy, lang }: { copy: Copy; lang: "cs" | "en" }) {
  const fmt = (s: string) => rich(lang === "cs" ? csCopy(s) : s);
  return (
    <section lang={lang} id={lang} className="scroll-mt-20">
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">{copy.title}</h1>
      <p className="text-sm text-muted-foreground mb-6">{copy.updated}</p>
      <p className="text-[17px] leading-relaxed mb-6">{fmt(copy.intro)}</p>
      <aside className="glass-panel rounded-3xl p-5 mb-10">
        <ul className="grid gap-2 sm:grid-cols-2 text-[15px] leading-snug">
          {copy.summary.map((s) => (
            <li key={s} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary shrink-0" aria-hidden />
              <span>{fmt(s)}</span>
            </li>
          ))}
        </ul>
      </aside>
      {copy.blocks.map((b) => (
        <div key={b.h} className="mb-8">
          <h2 className="text-xl font-semibold tracking-tight mb-3">{b.h}</h2>
          {b.p?.map((t) => (
            <p key={t} className="leading-relaxed text-muted-foreground mb-3">{fmt(t)}</p>
          ))}
          {b.ul && (
            <ul className="list-disc pl-5 space-y-2 leading-relaxed text-muted-foreground">
              {b.ul.map((t) => <li key={t}>{fmt(t)}</li>)}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}

export default function Terms() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Obchodní podmínky / Terms of service | Tokeny</title>
        <meta
          name="description"
          content="Obchodní podmínky služby Tokeny: tarify Free a Pro, ceny, předplatné, odstoupení od smlouvy, reklamace. Tokeny terms of service."
        />
        <link rel="canonical" href="https://tokeny.martinpohl.cz/terms" />
        <meta property="og:url" content="https://tokeny.martinpohl.cz/terms" />
        <meta property="og:type" content="website" />
      </Helmet>

      <PublicHeader />

      <article className="container mx-auto px-4 py-16 max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs">
            <FileText className="h-3 w-3" aria-hidden /> {EFFECTIVE.cs}
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
        <p>
          © {new Date().getFullYear()} <Link to="/" className="hover:text-foreground">Tokeny</Link> ·{" "}
          <Link to="/privacy" className="hover:text-foreground">Ochrana osobních údajů / Privacy</Link>
        </p>
      </footer>
    </div>
  );
}
