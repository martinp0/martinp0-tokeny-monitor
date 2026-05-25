import { Link } from "react-router-dom";
import BlogPostLayout from "@/components/BlogPostLayout";

export default function BlogMonitoringAiCosts() {
  return (
    <BlogPostLayout
      title="Monitoring AI nákladů: co měřit, jaké alerty nastavit a proč"
      description="Praktický návod, jaké KPI sledovat u LLM API — od daily spend přes anomálie po runaway agenty. S příklady alertů, dashboardů a typických red flagů."
      slug="monitoring-ai-costs"
      date="2026-05-25"
      tag="Monitoring & FinOps"
      keywords="ai cost monitoring, llm monitoring, openai usage tracking, anthropic cost tracking, ai finops, llm observability, ai budget alerts, runaway agent detection"
    >
      <p>
        AI náklady umí přes noc utrojit. Bug v agentovi, infinite loop, nový endpoint v produkci,
        marketing kampaň — a najednou faktura $5 000 místo $500. Bez monitoringu to zjistíš až
        z karty.
      </p>

      <h2>5 KPI, které musíš sledovat</h2>

      <h3>1. Daily spend (USD)</h3>
      <p>
        Základ. Sleduj denní útratu napříč providery. Alert pokud denní spend překročí <strong>1.5×
        7-day rolling average</strong> — to zachytí runaway loopy během hodin, ne dní.
      </p>

      <h3>2. Cost per request (avg)</h3>
      <p>
        Roste? Pravděpodobně se ti rozrostl prompt nebo kontext. Klesá? Dobrá zpráva, nebo někdo
        přepnul na levnější model — ověř kvalitu.
      </p>

      <h3>3. Input vs output token ratio</h3>
      <p>
        Output tokeny jsou typicky <strong>4–5× dražší</strong> než input. Vysoký output podíl signalizuje
        nezalimitované <code>max_tokens</code> nebo zbytečné "vysvětli proč" v promptech. Viz{" "}
        <Link to="/blog/prompt-optimization">prompt optimization</Link>.
      </p>

      <h3>4. Model mix</h3>
      <p>
        Kolik % requestů jede přes flagship vs mini? Pokud flagship dělá &gt;30 % a nejde o
        reasoning-heavy workload, máš prostor pro routing. Detail v{" "}
        <Link to="/blog/gpt-vs-claude-vs-gemini">srovnání modelů</Link>.
      </p>

      <h3>5. Latence per model</h3>
      <p>
        Nejen UX metrika — pomalé responses znamenají taky drahé streamy a často indikují problém
        u providera (před fakturací). Sleduj p50 a p95.
      </p>

      <h2>Alerty, které dávají smysl</h2>
      <ul>
        <li><strong>Budget threshold</strong> — 50 %, 80 %, 100 % měsíčního budgetu</li>
        <li><strong>Spike detection</strong> — hourly spend &gt; 3× medián posledních 24h</li>
        <li><strong>New model usage</strong> — někdo nasadil nový model, který v rozpočtu nebyl</li>
        <li><strong>Failed requests &gt; 5 %</strong> — platíš za chyby (často ano u rate limitů)</li>
        <li><strong>Single request &gt; $X</strong> — typicky runaway agent nebo špatný RAG</li>
      </ul>

      <h2>Red flags v dashboardu</h2>
      <ul>
        <li><strong>Plochá křivka, pak skok</strong> — nasazení / bug</li>
        <li><strong>Postupný drift nahoru</strong> — prompty rostou, kontext narůstá</li>
        <li><strong>Sinusoida přes noc</strong> — cron job nebo batch processing běží 24/7</li>
        <li><strong>Náhle nulová útrata</strong> — API key revoked nebo provider outage</li>
      </ul>

      <h2>Setup za 10 minut</h2>
      <p>
        Postup, který funguje pro malý/střední tým:
      </p>
      <ol>
        <li>Connect OpenAI/Anthropic/OpenRouter do <Link to="/auth">Tokeny Monitoru</Link></li>
        <li>Nastav měsíční budget alert (email na 80 %)</li>
        <li>Týdně 5 minut review: cost per request, model mix, top 5 nejdražších requestů</li>
        <li>Spočítej si očekávané náklady na nové featury v <Link to="/llm-cost-calculator">kalkulačce</Link> před nasazením</li>
      </ol>

      <h2>Pokročilé: per-feature attribution</h2>
      <p>
        U větších produktů přidej do každého requestu metadata (<code>user_id</code>, <code>feature</code>,
        <code>endpoint</code>). Pak víš, že 60 % nákladů jde na 5 % uživatelů, nebo že "experimentální"
        endpoint žere víc než hlavní produkt. Bez per-feature tagů je optimalizace hádání.
      </p>

      <h2>Co měřit nemá smysl</h2>
      <ul>
        <li><strong>Token count bez kontextu ceny</strong> — různé modely, různé ceny. Sleduj USD.</li>
        <li><strong>Total requests</strong> — bez cost / latence ti to neřekne nic</li>
        <li><strong>Daily spend bez 7-day average</strong> — víkendové výkyvy = false alerty</li>
      </ul>

      <p>
        Související: <Link to="/blog/ai-cost-saving">10 způsobů, jak ušetřit na AI</Link> ·{" "}
        <Link to="/blog/gpt-vs-claude-vs-gemini">Srovnání modelů 2026</Link> ·{" "}
        <Link to="/blog/token-window">Token window strategie</Link>
      </p>
    </BlogPostLayout>
  );
}
