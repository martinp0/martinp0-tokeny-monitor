import { Link } from "react-router-dom";
import BlogPostLayout from "@/components/BlogPostLayout";

export default function BlogModelComparison() {
  return (
    <BlogPostLayout
      title="GPT-5 vs Claude vs Gemini: srovnání 2026 (cena, rychlost, kvalita)"
      description="Detailní srovnání flagship modelů OpenAI, Anthropic a Google v roce 2026. Ceny per 1M tokenů, latence, context window, silné a slabé stránky — s doporučením, kdy který zvolit."
      slug="gpt-vs-claude-vs-gemini"
      date="2026-05-25"
      tag="Model comparison"
      keywords="gpt-5 vs claude, claude vs gemini, gpt vs claude vs gemini, llm comparison 2026, best llm 2026, openai vs anthropic vs google, llm pricing comparison"
    >
      <p>
        OpenAI, Anthropic a Google v roce 2026 nabízejí tři velmi odlišné flagship modely.
        Cena, rychlost i silné stránky se liší o řády — a volba špatného modelu může utrojit
        fakturu. Tady je přímé srovnání.
      </p>

      <h2>Ceník flagship modelů (USD / 1M tokenů)</h2>
      <ul>
        <li><strong>GPT-5</strong> — input <code>$1.25</code> / output <code>$10.00</code></li>
        <li><strong>Claude Sonnet 4.5</strong> — input <code>$3.00</code> / output <code>$15.00</code></li>
        <li><strong>Claude Opus 4</strong> — input <code>$15.00</code> / output <code>$75.00</code></li>
        <li><strong>Gemini 2.5 Pro</strong> — input <code>$1.25</code> / output <code>$10.00</code></li>
      </ul>
      <p>
        Spočítej si konkrétní use case v <Link to="/llm-cost-calculator">LLM cost calculator</Link>{" "}
        nebo se podívej na <Link to="/gpt-api-cost">detailní GPT ceník</Link> a{" "}
        <Link to="/claude-api-cost">Claude ceník</Link>.
      </p>

      <h2>Context window</h2>
      <ul>
        <li><strong>GPT-5</strong> — 400k tokenů</li>
        <li><strong>Claude Sonnet 4.5</strong> — 200k tokenů (1M v beta)</li>
        <li><strong>Gemini 2.5 Pro</strong> — 1M tokenů, plánováno 2M</li>
      </ul>
      <p>
        Velký context není zdarma — viz <Link to="/blog/token-window">token window strategie</Link>.
      </p>

      <h2>Silné stránky</h2>

      <h3>GPT-5</h3>
      <p>
        Nejvyrovnanější. Skvělý reasoning, dobré coding, solidní multimodalita. Thinking mode
        (extended reasoning) zvládá komplexní úlohy, ale platíš za thinking tokeny — pozor na cenu.
        Nejlepší volba, když nevíš co zvolit.
      </p>

      <h3>Claude Sonnet 4.5 / Opus 4</h3>
      <p>
        Krátí coding a agentní workflow. Vynikající instruction following, nejlepší tone of voice
        pro psaný obsah. Sonnet je sweet spot cena/výkon, Opus jen pro nejtěžší úlohy (a hluboké
        kapsy).
      </p>

      <h3>Gemini 2.5 Pro</h3>
      <p>
        Nejlepší multimodalita (video, audio, image), 1M context bez kompromisů v ceně inputu.
        Skvělý na analýzu velkých dokumentů a multimedia. Reasoning někdy zaostává za GPT-5.
      </p>

      <h2>Kdy který zvolit</h2>
      <ul>
        <li><strong>Chatbot / FAQ</strong> — GPT-5 mini nebo Claude Haiku. Žádný flagship.</li>
        <li><strong>Coding agent</strong> — Claude Sonnet 4.5. Nejvyšší tool-use accuracy.</li>
        <li><strong>Analýza velkých PDF / video</strong> — Gemini 2.5 Pro. Žádná konkurence.</li>
        <li><strong>Komplexní reasoning</strong> — GPT-5 thinking nebo Claude Opus.</li>
        <li><strong>Generování textu pro lidi</strong> — Claude Sonnet. Nejpřirozenější výstup.</li>
        <li><strong>High-volume klasifikace</strong> — GPT-5 nano nebo Gemini 2.5 Flash-Lite.</li>
      </ul>

      <h2>Rychlý cost příklad</h2>
      <p>
        10 000 requestů měsíčně, 2 000 in / 500 out:
      </p>
      <ul>
        <li><strong>GPT-5</strong>: $25 + $50 = <strong>$75/měs</strong></li>
        <li><strong>Claude Sonnet 4.5</strong>: $60 + $75 = <strong>$135/měs</strong></li>
        <li><strong>Gemini 2.5 Pro</strong>: $25 + $50 = <strong>$75/měs</strong></li>
        <li><strong>Claude Opus 4</strong>: $300 + $375 = <strong>$675/měs</strong></li>
      </ul>

      <h2>Doporučení</h2>
      <p>
        Nevol jeden model na všechno. Multi-model setup (router + flagship + nano) typicky ušetří
        <strong> 40–70 %</strong> oproti naivnímu "všechno přes GPT-5". Detail v článku{" "}
        <Link to="/blog/ai-cost-saving">10 způsobů, jak ušetřit na AI</Link>.
      </p>

      <p>
        Související: <Link to="/blog/monitoring-ai-costs">Monitoring AI nákladů</Link> ·{" "}
        <Link to="/blog/prompt-optimization">Optimalizace promptů</Link> ·{" "}
        <Link to="/how-to-calculate-llm-cost">Jak spočítat LLM cost</Link>
      </p>
    </BlogPostLayout>
  );
}
