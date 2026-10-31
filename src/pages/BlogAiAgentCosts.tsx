import { Link } from "react-router-dom";
import BlogPostLayout from "@/components/BlogPostLayout";
import { DailySpendChart } from "@/components/blog/DailySpendChart";

const TOKEN_ROWS = [
  { kind: "Čtení z mezipaměti (cached)", tokens: "6,96 mld.", share: "95 %" },
  { kind: "Zápis do mezipaměti (cache write)", tokens: "219 mil.", share: "3 %" },
  { kind: "Nový vstup (prompt)", tokens: "126 mil.", share: "2 %" },
  { kind: "Výstup (completion)", tokens: "52 mil.", share: "< 1 %" },
];

export default function BlogAiAgentCosts() {
  return (
    <BlogPostLayout
      title="Kolik doopravdy stojí AI agenti: měsíc dat, 7,3 miliardy tokenů a 859 dolarů"
      description="Měsíc reálných dat z Grok Botu a Cursoru: 85 179 volání modelu, přes 7,3 miliardy tokenů, 95 % z mezipaměti a 859 USD nad rámec tarifu. Co z toho plyne."
      slug="kolik-stoji-ai-agenti"
      date="2026-10-30"
      dateLabel="30. 10. 2026"
      tag="Reálná data"
      keywords="kolik stojí ai agenti, náklady na ai agenty, grok bot cena, cursor cena, prompt caching, tokeny, on-demand"
    >
      <p>
        Každý den pracuju s AI agenty, s Grok Botem a s Cursorem. Oba umí vyexportovat využití do CSV,
        a tak jsem si stáhl export za 1.–30. října 2026 a podíval se, kam tokeny a peníze doopravdy jdou.
        Žádné odhady, jen čísla z exportu.
      </p>

      <h2>Čísla za 1.–30. října</h2>
      <ul>
        <li><strong>85 179</strong> volání modelu (Grok Bot + Cursor).</li>
        <li>
          <strong>859 USD</strong> za využití nad rámec tarifu: Grok Bot <strong>482 USD</strong>, Cursor{" "}
          <strong>377 USD</strong>. Paušál samotného tarifu v tom není, export ukazuje jen využití.
        </li>
        <li>
          Přes <strong>7,3 miliardy tokenů</strong>: 6,96 mld. čtení z mezipaměti, 219 mil. zápisů do
          mezipaměti, 126 mil. nového vstupu a 52 mil. výstupu.
        </li>
      </ul>

      <h2>95 % tokenů jsou tokeny z mezipaměti</h2>
      <p>
        Agent při každém kroku posílá modelu znovu celý kontext: instrukce, nástroje, historii a soubory.
        Díky prompt cachingu se většina z toho nepočítá jako nový vstup, ale jako levné čtení z mezipaměti.
        U mě to bylo 95 % všech tokenů.
      </p>
      <div className="not-prose glass rounded-2xl overflow-x-auto my-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border/50">
              <th className="px-4 py-3 font-medium">Druh tokenů</th>
              <th className="px-4 py-3 font-medium text-right">Počet</th>
              <th className="px-4 py-3 font-medium text-right">Podíl</th>
            </tr>
          </thead>
          <tbody>
            {TOKEN_ROWS.map((r) => (
              <tr key={r.kind} className="border-b border-border/30 last:border-0">
                <td className="px-4 py-3">{r.kind}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.tokens}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.share}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Bez mezipaměti by stejná práce znamenala platit plnou cenu vstupu za miliardy tokenů. Nový vstup
        a výstup, tedy to, co si člověk pod „tokeny“ obvykle představí, je dohromady jen pár procent.
      </p>

      <h2>Agenti neutrácí rovnoměrně</h2>
      <p>
        Nejdražší den byl <strong>22. 10. (258 USD)</strong>. Další špičky přišly hned 23. 10. (179 USD)
        a pak <strong>28. a 29. 10. (183 a 169 USD)</strong>. Klidné dny stojí centy nebo nic: první tři
        týdny měsíce pokryl tarif celé a nad jeho rámec jsem nezaplatil nic.
      </p>
      <DailySpendChart />
      <p>
        Útrata tedy neroste rovnoměrně s časem, ale ve skocích. Jediný drahý den stál víc, než kolik
        jsem nad rámec tarifu zaplatil za celé první tři týdny dohromady (tedy nula).
      </p>

      <h2>Co si z toho beru</h2>
      <ul>
        <li>
          <strong>Sledovat útratu denně, ne měsíčně.</strong> Měsíční faktura řekne jen součet. Špičku
          22. 10. bych na ní nepoznal, a právě tam se rozhoduje.
        </li>
        <li>
          <strong>Rozlišovat tarif a on-demand.</strong> Dokud vystačí tarif, další volání nic nestojí. Peníze
          navíc začnou téct až po jeho vyčerpání, takže stojí za to vědět, kdy k tomu dojde.
        </li>
        <li>
          <strong>Mezipaměť je nejlevnější optimalizace.</strong> Stabilní instrukce a kontext na začátku
          promptu znamenají, že se většina tokenů čte z cache. Víc v článku o{" "}
          <Link to="/blog/grok-token-optimization">optimalizaci tokenů u Groku</Link>.
        </li>
        <li>
          <strong>Bez dat se návratnost nedá posoudit.</strong> 859 USD za měsíc může být hodně, nebo málo.
          Záleží na tom, co za ně agenti udělali, a to člověk zjistí jen tehdy, když ví, kolik stál který den
          a která práce.
        </li>
      </ul>

      <h2>Proto stavím Tokeny</h2>
      <p>
        Tokeny jsou dashboard, který ukáže denní útratu za AI napříč poskytovateli v USD i v korunách.
        Nově umí nahrát i <strong>CSV export využití z Cursoru a Grok Bota</strong>. Rozliší tokeny
        z mezipaměti od nových a útratu v rámci tarifu od té nad jeho rámec. Soubor se zpracuje přímo
        v prohlížeči a e-maily ani ID uživatelů z exportu se neukládají.
      </p>
      <p>
        <Link to="/auth">Vyzkoušej Tokeny zdarma</Link> a nahraj svůj export. Nebo si nejdřív spočítej
        odhad v <Link to="/llm-cost-calculator">kalkulačce nákladů</Link>.
      </p>
    </BlogPostLayout>
  );
}
