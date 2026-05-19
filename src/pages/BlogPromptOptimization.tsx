import { Link } from "react-router-dom";
import BlogPostLayout from "@/components/BlogPostLayout";

export default function BlogPromptOptimization() {
  return (
    <BlogPostLayout
      title="Optimalizace promptů: jak zkrátit tokeny a zlepšit výsledky"
      description="Konkrétní techniky prompt optimization — strukturované prompty, few-shot pruning, prompt compression. S příklady před/po a měřitelným dopadem na cenu i kvalitu."
      slug="prompt-optimization"
      date="2026-05-19"
      tag="Prompt engineering"
      keywords="prompt optimization, prompt engineering, prompt compression, few-shot pruning, token reduction, llm prompt cost"
    >
      <p>
        Dobrý prompt je krátký, jasný a deterministický. Špatný prompt je dlouhý, vágní a drahý.
        Tady je 6 technik, jak prompty zkrátit <strong>o 30–60 %</strong> a často při tom zlepšit i kvalitu.
      </p>

      <h2>1. Instrukce dopředu, kontext potom</h2>
      <p>
        Modely platí pozornost hlavně začátku a konci promptu. Umísti hlavní instrukci na začátek,
        pak data, pak shrnutí úkolu. Lepší follow rate, méně retry, nižší cost.
      </p>

      <h2>2. Few-shot pruning</h2>
      <p>
        Začni s 5 příklady, postupně ubírej a měř kvalitu. Často zjistíš, že <strong>2 příklady stačí</strong>.
        Ušetříš tisíce tokenů per request.
      </p>

      <p><strong>Před:</strong> 5 příkladů × 200 tokenů = 1000 tokenů</p>
      <p><strong>Po:</strong> 2 příklady × 200 tokenů = 400 tokenů → <strong>−60 % input</strong></p>

      <h2>3. Strukturovaný JSON output</h2>
      <p>
        Místo "vysvětli a vrať odpověď" požaduj striktní schema. Použij{" "}
        <code>response_format: json_schema</code>. Méně output tokenů, parsovatelný výsledek,
        deterministický behavior.
      </p>

      <h2>4. Zkratky a symboly</h2>
      <p>
        Modely rozumí "Q:" a "A:", "USR:" a "AST:", "→" místo "results in". V system promptu nebo
        few-shot příkladech to ušetří desítky tokenů.
      </p>

      <h2>5. Prompt compression nástroje</h2>
      <p>
        Knihovny jako <strong>LLMLingua</strong> umí promptu zredukovat na 30–50 % původní délky
        s minimální ztrátou kvality. Pro velké RAG kontexty nezbytné.
      </p>

      <h2>6. Eliminuj "buďte zdvořilí, prosím"</h2>
      <p>
        "You are a helpful assistant. Please carefully consider..." — tohle nic nezlepší a stojí to
        tokeny. Buď přímý: <em>"Classify the text as one of: A, B, C. Output only the letter."</em>
      </p>

      <h2>Měřitelnost: nehádej, testuj</h2>
      <p>
        Každou změnu promptu prožeň testovacím setem (50–200 příkladů) a porovnej:
      </p>
      <ul>
        <li><strong>Accuracy</strong> — drží kvalita?</li>
        <li><strong>Avg tokens in/out</strong> — kolik jsi reálně ušetřil?</li>
        <li><strong>Cost per request</strong> — výsledek obou výše</li>
      </ul>

      <p>
        Bez měření je prompt engineering jen pověra. Skutečné náklady na model napříč experimenty
        sleduj v <Link to="/auth">Tokeny Monitoru</Link> nebo si je předem spočítej v{" "}
        <Link to="/llm-cost-calculator">kalkulačce</Link>.
      </p>

      <h2>Reálný příklad</h2>
      <p>
        Klasifikace 50k support ticketů měsíčně:
      </p>
      <ul>
        <li>Před optimalizací: GPT-4o, 1200 in / 150 out, $0.18/request → <strong>$9 000/měs</strong></li>
        <li>Po: GPT-4o mini + strukturovaný JSON + 2 few-shot, 400 in / 5 out → <strong>$0.062/měs… per 1000 ticketů</strong> = $3.1/měs</li>
      </ul>
      <p>
        <strong>2900× levnější.</strong> Žádná magie — jen menší model + kratší prompt + striktní output.
      </p>

      <p>
        Související: <Link to="/blog/ai-cost-saving">10 způsobů, jak ušetřit na AI</Link> ·{" "}
        <Link to="/blog/token-window">Token window strategie</Link>
      </p>
    </BlogPostLayout>
  );
}
