import BlogPostLayout from "@/components/BlogPostLayout";
import { Link } from "react-router-dom";

export default function BlogMultiProvider() {
  return (
    <BlogPostLayout
      title="Multi-provider monitoring: 7 AI providerů v jednom dashboardu"
      description="Tokeny Monitor teď podporuje OpenRouter, Anthropic, OpenAI, Google Gemini, Mistral, Groq a xAI (Grok). Proč to dává smysl, jak to funguje a jak začít."
      slug="multi-provider-monitoring"
      date="2026-06-30"
      tag="Product update"
      keywords="multi-provider AI, OpenRouter, Anthropic, OpenAI, Gemini, Mistral, Groq, xAI, Grok, monitoring AI nákladů"
    >
      <p>
        Většina týmů dnes nepoužívá jen jednoho AI providera. Klasický setup:
        <strong> GPT-5 na produkční chat</strong>, <strong>Claude Sonnet na code review</strong>,
        <strong> Gemini Flash na masivní extraction</strong> a <strong>Groq nebo Mistral
        na cheap fallback</strong>. Každý provider má vlastní dashboard, vlastní
        ceník, vlastní formát exportu — a finance má z toho hlavu jako pivní bečku.
      </p>

      <p>
        Proto v Tokeny Monitor od dneška podporujeme <strong>7 providerů</strong>
        v jednom přehledu: <em>OpenRouter, Anthropic, OpenAI, Google Gemini,
        Mistral AI, Groq a xAI (Grok)</em>.
      </p>

      <h2>Proč multi-provider strategie dává smysl</h2>
      <ul>
        <li><strong>Cena se liší 10–100×.</strong> Groq llama-3.3-70b je o řád
          levnější než GPT-5 a pro 80 % úloh stačí.</li>
        <li><strong>Latence.</strong> Groq zvládá 500+ tok/s, Gemini Flash má
          stabilní p99 pod sekundu. GPT-5 na thinking módu klidně 30 s.</li>
        <li><strong>Resilience.</strong> Když jeden provider spadne (a stane se
          to), routovat na záložního trvá vteřiny — pokud máš klíče připravené.</li>
        <li><strong>Vendor lock-in risk.</strong> Closed beta, EOL modelu,
          pricing change — diverzifikace chrání rozpočet.</li>
      </ul>

      <h2>Co která integrace umí</h2>

      <h3>Plnohodnotný sync (per-request data)</h3>
      <ul>
        <li><strong>OpenRouter</strong> — per-generation rows přes <code>/activity</code>
          endpoint. Vidíš každý request, model, latency, finish reason.</li>
        <li><strong>Anthropic</strong> — Admin API (<code>/v1/organizations/usage_report/messages</code>),
          time-bucketed aggregáty po dnech/hodinách. Vyžaduje admin key.</li>
        <li><strong>OpenAI</strong> — Usage API stejným způsobem, admin key
          z Organization settings.</li>
      </ul>

      <h3>Evidence klíče + CSV import (zatím)</h3>
      <ul>
        <li><strong>Google Gemini</strong> — billing přes GCP, per-key usage API
          neexistuje. Klíč si můžeš uložit pro evidenci, data tahej z Google Cloud
          Billing exportu.</li>
        <li><strong>Mistral, Groq, xAI</strong> — žádný veřejný per-key usage
          endpoint. Klíč si uložíš, historická data nahraješ CSV uploadem.</li>
      </ul>

      <p className="text-sm text-muted-foreground">
        Pozn.: jakmile kterýkoli z těchto providerů vydá usage API, sync se zapne
        automaticky — kód je připravený.
      </p>

      <h2>Jak to vypadá v dashboardu</h2>
      <p>
        Všechny providery se sčítají do jedněch KPI (<em>total spend, tokens,
        requests</em>), zároveň je můžeš filtrovat per provider. Cost chart
        ukazuje stack po providerech, model comparison drží spread napříč
        vendory. Costs jsou vždy v USD, převod do CZK počítá denní ČNB kurz.
      </p>

      <h2>Bezpečnost klíčů</h2>
      <p>
        API klíče se ukládají do <code>provider_credentials</code> s column-level
        GRANT — browser je <strong>nikdy</strong> nedostane zpět ven. Sync běží
        na serveru přes Edge Function se service-role přístupem. Pokud klíč
        smažeš, smaže se okamžitě a sync se zastaví.
      </p>

      <h2>Jak začít</h2>
      <ol>
        <li>Otevři <Link to="/dashboard">Dashboard</Link> a klikni na
          <em> API integrace → Přidat klíč</em>.</li>
        <li>Vyber providera, vlož klíč (u Anthropic/OpenAI <strong>admin key</strong>,
          ne běžný API key).</li>
        <li>Klikni <em>Sync</em>. U OpenRouter/Anthropic/OpenAI naběhnou data
          okamžitě, u ostatních použij CSV upload tlačítko vedle.</li>
        <li>Nastav <Link to="/settings">budget alert</Link>, ať tě každý měsíc
          neminul nečekaný billing shock.</li>
      </ol>

      <h2>Praktický playbook: routing podle ceny</h2>
      <p>
        Když máš všech 7 providerů na jednom dashboardu, najednou je vidět,
        kde se reálně točí peníze. Nejčastější optimalizace, co u zákazníků
        vidíme:
      </p>
      <ul>
        <li><strong>Classifikace a routing → Groq llama-3.3-70b.</strong>
          0,59 $/1M output, latence pod 300 ms. Šetří 90 % nákladů oproti GPT-5.</li>
        <li><strong>Bulk extraction → Gemini 2.5 Flash.</strong> 1M context,
          extrémně levné, multimodální.</li>
        <li><strong>Production chat → Claude Sonnet 4.6 nebo GPT-5.</strong>
          Tam, kde kvalita opravdu rozhoduje.</li>
        <li><strong>Coding agents → Claude Sonnet + Anthropic prompt caching.</strong>
          Cache hit ratio 70%+ srazí cenu na desetinu.</li>
        <li><strong>Mistral / Grok jako fallback</strong> při výpadku primárního.</li>
      </ul>

      <p>
        Bez monitoringu jsou tyhle úspory jen teorie. <Link to="/llm-cost-calculator">
        Spočítej si potenciál</Link> nebo si rovnou <Link to="/auth">založ účet</Link>
        a začni sledovat realitu.
      </p>

      <h2>Co dál</h2>
      <p>
        Na řadě je: Together AI, Perplexity API, DeepSeek a OpenRouter
        BYOK detail tracking. Pokud používáš providera, který ti tu chybí,
        napiš — přidáváme rychle.
      </p>
    </BlogPostLayout>
  );
}
