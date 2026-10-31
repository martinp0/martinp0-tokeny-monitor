# Plán vylepšení Tokeny Monitor

Níže je shortlist toho, co dává největší smysl řešit dál. Rozdělené podle dopadu vs. úsilí. Vyber, co rozjedeme.

## 🚀 Quick wins (1–2 hodiny každé)

1. **Onboarding tour** – první přihlášený uživatel dostane 3-krokový průvodce (CSV upload → filtry → AI agent). Driver.js nebo vlastní tooltip overlay.
2. **Empty states s akcí** – když nejsou data, místo prázdného grafu CTA "Nahrát CSV" / "Připojit OpenRouter".
3. **Keyboard shortcuts** – `cmd+k` command palette (filtry, navigace, export), `g d` na dashboard, `?` nápověda.
4. **Skeleton loadery** – nahradit současné spinnery v dashboardu (KPI, grafy) za skeletony – působí rychleji.
5. **Dark/light toggle** – aktuálně je všude dark; přidat světlý režim s přepínačem.

## 📊 Funkční vylepšení (půl dne každé)

6. **Cost alerts v reálném čase** – kromě měsíčního budgetu i denní/týdenní limit + push/email při překročení predikce.
7. **Porovnání období** – „tento měsíc vs. minulý" overlay v cost grafu, % změna v KPI kartách.
8. **Tagování requestů** – uživatel může označit requesty (projekt, klient, environment); filtr a breakdown podle tagů. Vyžaduje migraci.
9. **Bulk akce v tabulce** – multi-select, hromadné mazání, export výběru.
10. **Saved views** – uložit kombinaci filtrů jako pojmenovaný preset (např. „Produkce GPT-5").

## 💰 Monetizace & růst

11. **Pro features paywall hardening** – aktuálně máte `ProGate`; zrevidovat, co je za paywallem (sdílení, AI agent, export, MCP) a přidat upgrade promty.
12. **Affiliate / referral** – uživatel získá měsíc Pro za pozvaného přítele.
13. **Public showcase galerie** – opt-in seznam veřejně sdílených dashboardů (anonymizované) jako social proof na landing.
14. **Týmy / workspaces** – sdílení účtu mezi více uživateli s rolemi (owner/member). Větší změna – samostatný projekt.

## 🤖 AI vylepšení

15. **Proaktivní insights** – cron (1×denně) projede data přes Lovable AI a vygeneruje 3 doporučení („Model X stojí 40 % nákladů, ale Y je 5× levnější s podobnou kvalitou").
16. **Anomaly detection v2** – aktuálně máte AnomalyPanel; přidat e-mail notifikace při detekci.
17. **Natural language export** – „dej mi CSV requestů z minulého týdne nad $0.10" → AI agent vygeneruje a stáhne.

## 🔒 Tech & kvalita

18. **E2E testy** – Playwright už máte, ale prázdné. Přidat smoke testy: login → upload CSV → vidím dashboard.
19. **Sentry / error tracking** – nahlásit JS chyby z produkce.
20. **Performance audit** – `useDashboardData` přepočítává hodně při každém filtru; zvážit Web Worker nebo memoizaci na úrovni Supabase view.
21. **Mobile UX** – aktuální viewport je 420px; revidovat mobilní navigaci a tabulku requestů (horizontální scroll je rough).

---

## Doporučené pořadí

Pokud máš omezený čas, šel bych takhle:

1. **Skeleton loadery + empty states s CTA** (rychlé, viditelný UX win)
2. **Porovnání období v KPI** (vysoká hodnota pro uživatele, půl dne)
3. **Saved views** (drží uživatele v appce)
4. **Proaktivní AI insights** (diferenciační feature, marketing materiál)
5. **Mobile UX cleanup** (rozšíří publikum)

Řekni, které body (čísla) chceš rozjet, nebo jestli mám něco upřesnit / přidat.