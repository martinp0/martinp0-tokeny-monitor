import { Link } from "react-router-dom";
import BlogPostLayout from "@/components/BlogPostLayout";

export default function BlogTokenWindow() {
  return (
    <BlogPostLayout
      title="Token window: jak pracovat s dlouhým kontextem chytře"
      description="Sliding window, RAG, summary chains a context pruning. Kdy se vyplatí 1M token context window a kdy je to drahý overkill."
      slug="token-window"
      date="2026-05-19"
      tag="Context management"
      keywords="token window, context window, long context llm, sliding window, rag, summary chain, context pruning, gemini 1m tokens"
    >
      <p>
        Moderní modely nabízejí 200k (Claude), 400k (GPT-5) i 1M (Gemini) token context. Lákavé hodit
        do promptu celý codebase a "ať si poradí". Pak přijde faktura.
      </p>

      <p>
        Velký context window má dvě skryté daně: <strong>cost</strong> (input tokeny se sčítají rychle)
        a <strong>kvalita</strong> (modely zapomínají, co je uprostřed — "lost in the middle" efekt).
      </p>

      <h2>Kdy 1M context dává smysl</h2>
      <ul>
        <li>Jednorázová analýza dokumentu/repa (research, audit)</li>
        <li>Komplexní reasoning, kde potřebuješ vidět všechny souvislosti najednou</li>
        <li>Multimodal úlohy (video + text)</li>
      </ul>

      <h2>Kdy je 1M context drahý overkill</h2>
      <ul>
        <li>Chatbot s history starou týden — kdo si po týdnu pamatuje, co se řešilo?</li>
        <li>RAG nad dokumentací — 5 relevantních chunků překoná full dump v přesnosti i ceně</li>
        <li>Agentní workflow — každý krok znovu odešle 50k tokenů kontextu, který už nepotřebuje</li>
      </ul>

      <h2>4 strategie pro chytré context management</h2>

      <h3>1. Sliding window</h3>
      <p>
        Drž posledních N zpráv (typicky 10–20). Starší zahoď nebo summarizuj. Vhodné pro chat.
      </p>

      <h3>2. Summary chain</h3>
      <p>
        Každých M zpráv nech model udělat krátké shrnutí předchozího kontextu. Místo 50k history pošleš
        500 token summary + posledních 5 zpráv. Drží <strong>80 %+ kontextu</strong> za zlomek ceny.
      </p>

      <h3>3. RAG (Retrieval-Augmented Generation)</h3>
      <p>
        Embedduj dokumenty, retrievuj jen relevantní chunky. Pro většinu Q&A use casů poráží long-context
        v poměru cena/kvalita o řád.
      </p>

      <h3>4. Context pruning</h3>
      <p>
        Před každým requestem prober kontext: drop tool výstupy starší 3 krokůý, smaž duplicitní info,
        zkomprimuj failed attempty. Pro AI agenty kritické — bez pruningu utratíš $50/hod na jedno
        spuštění.
      </p>

      <h2>Konkrétní čísla</h2>
      <p>
        Agent řešící bug, 30 kroků, každý krok přidá tool output (~2k tokenů):
      </p>
      <ul>
        <li><strong>Naivně:</strong> krok 30 platí 60k input tokenů. Cumulative input: ~900k tokenů.</li>
        <li><strong>S pruningem (jen posledních 5 toolů + summary):</strong> ~10k tokenů/krok, cumulative ~300k.</li>
      </ul>
      <p>
        <strong>3× levnější</strong>, a navíc model líp drží pozornost na aktuální problém.
      </p>

      <h2>Long context není zdarma, ani když "jde"</h2>
      <p>
        Gemini 2.5 Pro je za $1.25/1M input. 500k token request = $0.625 jen na input. 1000 takových
        requestů denně = $625/den, $19k/měs. Většina týmů by stejný výsledek dostala za 10× míň přes
        RAG.
      </p>

      <h2>Praxe: měř input tokeny per request</h2>
      <p>
        V <Link to="/auth">Tokeny Monitoru</Link> sleduj <em>avg input tokens per request</em> v čase.
        Pokud roste, máš v kontextu balast. Spočítej si dopad cenovky v{" "}
        <Link to="/llm-cost-calculator">LLM cost calculator</Link>.
      </p>

      <p>
        Související: <Link to="/blog/ai-cost-saving">10 způsobů, jak ušetřit na AI</Link> ·{" "}
        <Link to="/blog/prompt-optimization">Optimalizace promptů</Link>
      </p>
    </BlogPostLayout>
  );
}
