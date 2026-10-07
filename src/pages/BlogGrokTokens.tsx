import BlogPostLayout from "@/components/BlogPostLayout";
import { Link } from "react-router-dom";

export default function BlogGrokTokens() {
  return (
    <BlogPostLayout
      title="Jak optimalizovat tokeny u Grok API (xAI): 7 praktických tipů"
      description="Jak snížit spotřebu tokenů a náklady při používání Grok bota přes xAI API: kratší výstupy, správa historie, prompt caching, výběr modelu a měření."
      slug="grok-token-optimization"
      date="2026-10-07"
      tag="Cost optimization"
      keywords="grok api cost, xai grok tokeny, grok token optimization, grok pricing, snížení nákladů grok"
    >
      <p>
        Grok od xAI je oblíbený pro chatboty i agenty, ale účet za tokeny dokáže
        rychle narůst. Dobrá zpráva: většinu nákladů řídí pár páček, které máš
        pod kontrolou. Tady je 7 nejúčinnějších.
      </p>

      <h2>1. Hlídej výstup – je nejdražší</h2>
      <p>
        Výstupní tokeny jsou u Grok modelů dražší než vstupní. Nastav
        <code> max_tokens</code>, žádej stručný formát (odrážky, JSON) a zakaž
        modelu opakovat zadání před odpovědí.
      </p>

      <h2>2. Nepřeposílej celou historii chatu</h2>
      <p>
        Každá další zpráva posílá celou dosavadní konverzaci znovu jako vstup.
        U padesáti tahů tak první zprávy platíš padesátkrát. Řešení: posílej jen
        posledních N zpráv a starší část průběžně shrnuj do krátkého souhrnu.
      </p>

      <h2>3. Využij prompt caching</h2>
      <p>
        Stejný systémový prompt nebo velký dokument posílaný opakovaně se vyplatí
        cachovat – čtení z cache je výrazně levnější. Statický obsah dej na
        začátek a drž ho bajt po bajtu stejný; i změna mezery cache rozbije.
        Cache je krátkodobá, takže u dlouhých pauz mezi requesty se úspora ztrácí.
      </p>

      <h2>4. Ořež RAG kontext</h2>
      <p>
        Dvacet vložených úryvků místo pěti násobí cenu vstupu, ale kvalitu
        odpovědi obvykle nezlepší. Výsledky seřaď podle relevance a pošli jen to,
        co prokazatelně pomáhá.
      </p>

      <h2>5. Vyber model podle úlohy</h2>
      <p>
        Reasoning modely účtují i své „přemýšlení“ jako výstupní tokeny, i když
        uživatel vidí dvě věty. Pro jednoduché úlohy (klasifikace, extrakce,
        krátké odpovědi) použij rychlejší a levnější variantu Groku a silný model
        nech na složité dotazy.
      </p>

      <h2>6. Měř skutečnou spotřebu</h2>
      <p>
        Odhad podle počtu slov je nepřesný. Čti pole <code>usage</code> z každé
        odpovědi (prompt, completion, total tokens) a ukládej ho spolu s modelem
        a funkcí aplikace – jen tak zjistíš, co tě reálně stojí peníze.
      </p>

      <h2>7. Počítej s limity podle tokenů</h2>
      <p>
        Rate limity xAI se řídí hlavně počtem tokenů za minutu, ne počtem
        requestů. Pár dlouhých dotazů tak může skončit chybou 429. Při nastavení
        limitů výdajů počítej s tím, že je API odmítne – aplikace by na to měla
        reagovat slušně, ne spadnout.
      </p>

      <h2>Pozor na ceník</h2>
      <p>
        Ceny za 1M tokenů se u Groku mění s každou generací modelů. Aktuální
        sazby si vždy ověř přímo v dokumentaci a konzoli xAI, ne v tabulkách na
        blozích.
      </p>

      <h2>Další krok</h2>
      <p>
        Spočítej si, kolik by tě stál tvůj provoz, v{" "}
        <Link to="/llm-cost-calculator">LLM kalkulačce nákladů</Link>, projdi si{" "}
        <Link to="/blog/prompt-optimization">optimalizaci promptů</Link> a{" "}
        <Link to="/blog/token-window">práci s token window</Link>. Pokud
        kombinuješ Grok s dalšími providery, sleduj vše na jednom místě – viz{" "}
        <Link to="/blog/multi-provider-monitoring">multi-provider monitoring</Link>.
      </p>
    </BlogPostLayout>
  );
}
