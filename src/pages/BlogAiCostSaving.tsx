import { Link } from "react-router-dom";
import BlogPostLayout from "@/components/BlogPostLayout";

export default function BlogAiCostSaving() {
  return (
    <BlogPostLayout
      title="10 způsobů, jak ušetřit na AI API nákladech v roce 2026"
      description="Praktický playbook pro snížení LLM nákladů o 40–80 % bez ztráty kvality. Caching, model routing, batch API, prompt komprese a další taktiky s reálnými čísly."
      slug="ai-cost-saving"
      date="2026-05-19"
      tag="Cost optimization"
      keywords="ai cost saving, llm cost optimization, openai cost reduction, claude cost saving, prompt caching, ai api savings"
    >
      <p>
        Účet za AI API roste rychleji než revenue? Nejsi sám. Většina týmů, kterým jsme se dívali pod ruku,
        utrácí o <strong>40–70 % víc, než musí</strong>. Tady je 10 taktik, které fungují v produkci.
      </p>

      <h2>1. Routing modelů podle složitosti</h2>
      <p>
        Nepoužívej GPT-5 na všechno. Klasifikace, krátké odpovědi a routing může dělat GPT-4o mini nebo
        Claude Haiku za <strong>10–20× nižší cenu</strong>. Komplexní reasoning nech na flagship modelu.
        Jednoduchý "router" prompt na malém modelu rozhodne, kam dotaz pošle.
      </p>

      <h2>2. Prompt caching</h2>
      <p>
        Anthropic, OpenAI i Gemini podporují cache opakovaných částí promptu (system prompt, RAG kontext,
        few-shot příklady). Cached tokeny stojí <strong>10–25 % normální ceny</strong>. U agentů s velkým
        system promptem to bývá největší jednorázová úspora.
      </p>

      <h2>3. Batch API místo realtime</h2>
      <p>
        Pokud nepotřebuješ odpověď do sekund (klasifikace logů, embedding, hromadné generování),
        použij batch endpoint. <strong>50% sleva</strong> oproti běžnému API u OpenAI i Anthropic.
      </p>

      <h2>4. Zkracuj system prompty</h2>
      <p>
        Každý request platí celý system prompt znovu (pokud necachuješ). 2 000 zbytečných tokenů × 100k requestů =
        200M tokenů měsíčně navíc. Audituj prompty, mažeš mrtvé instrukce.
      </p>

      <h2>5. max_tokens limit</h2>
      <p>
        Model rád generuje delší odpovědi než potřebuješ. Tvrdě limituj <code>max_tokens</code>.
        U JSON response formátu to dramaticky snižuje výstupní tokeny.
      </p>

      <h2>6. Strukturovaný output místo "vysvětli proč"</h2>
      <p>
        Když potřebuješ jen výsledek, nech model vrátit JSON. Free-form "step by step thinking" zní hezky,
        ale platíš za každý token. Pro reasoning modely (o1, GPT-5 thinking) je to často <strong>největší
        položka faktury</strong>.
      </p>

      <h2>7. Streaming a early termination</h2>
      <p>
        Streamuj odpovědi a zastav generování, jakmile máš co potřebuješ (např. první JSON blok). Šetří
        output tokeny v hraničních case-ech.
      </p>

      <h2>8. Cache výsledků (ne jen promptu)</h2>
      <p>
        Identický vstup = identický výstup? Cachuj. Redis nebo i jednoduchá tabulka v Postgresu. U FAQ
        bota nebo klasifikace se cache hit ratio běžně dostane nad <strong>30 %</strong>.
      </p>

      <h2>9. Embeddings + retrieval místo kontextu</h2>
      <p>
        Místo cpaní celé dokumentace do contextu udělej RAG. 5 relevantních chunků (500 tokenů) je
        levnější než 50k token dump a často přesnější.
      </p>

      <h2>10. Měř, nehádej</h2>
      <p>
        Bez monitoringu nezachytíš runaway loop, infinite agenta nebo bug, který strojí $200/den. Connect
        OpenAI/Anthropic přes <Link to="/auth">Tokeny Monitor</Link> a sleduj denní spend.
      </p>

      <h2>Kolik to celkově ušetří?</h2>
      <p>
        Realistický mix těchto taktik dává <strong>40–80 % snížení faktury</strong> u většiny use casů.
        Začni routingem a cachem — to jsou typicky největší rychlé výhry.
      </p>

      <p>
        Související: <Link to="/blog/prompt-optimization">Optimalizace promptů</Link> ·{" "}
        <Link to="/blog/token-window">Token window strategie</Link> ·{" "}
        <Link to="/llm-cost-calculator">Spočítej si reálné náklady</Link>
      </p>
    </BlogPostLayout>
  );
}
