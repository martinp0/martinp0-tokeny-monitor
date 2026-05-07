
# Implementace 4 features

## 1. Changelog modal (What's New)
- Vytvořit `src/components/ChangelogModal.tsx` — modal s verzemi a změnami (hardcoded array)
- Uložit `last_seen_version` do `localStorage` (není potřeba DB)
- Zobrazit badge "New" na tlačítku v dashboardu, pokud uživatel ještě neviděl poslední verzi
- Tlačítko v headeru dashboardu (ikona `Megaphone` nebo `Bell`)

## 2. User profil / účet (GDPR)
- Vytvořit `src/pages/Profile.tsx` s:
  - Změna hesla (Supabase `updateUser`)
  - Změna display name (update profiles tabulky)
  - Export dat — stáhne CSV se všemi `activity_rows` uživatele
  - Smazání účtu — Edge Function s `service_role` key smaže data + auth user
- Přidat route `/profile` do `App.tsx`
- Edge Function `delete-account/index.ts` — smaže activity_rows + profil + auth.users záznam

## 3. Sdílené dashboardy (public read-only)
- **Migrace:** Nová tabulka `shared_dashboards` (id, user_id, share_token, filters JSON, created_at, expires_at)
  - RLS: uživatel vidí/vytváří/maže jen své sdílení
  - Public SELECT policy pro čtení přes share_token (bez auth)
- Tlačítko "Sdílet" v dashboardu → vygeneruje link `/shared/:token`
- Nová stránka `src/pages/SharedDashboard.tsx` — read-only dashboard s daty z tokenu
- Edge Function `get-shared-dashboard/index.ts` — načte data pro share_token (service_role, obejde RLS)

## 4. i18n (EN/CZ)
- Nainstalovat `i18next` + `react-i18next`
- Vytvořit `src/i18n/` s `cs.json` a `en.json` překladovými soubory
- Inicializace v `main.tsx`, default jazyk `cs`
- Přepínač jazyka v headeru dashboardu + na landing page
- Přeložit: Landing page, Dashboard labels, Settings, Auth stránky

## Pořadí implementace
1. Changelog modal (nejmenší, rychlé)
2. User profil/účet + delete-account Edge Function
3. Sdílené dashboardy (migrace + Edge Function + nová stránka)
4. i18n (průřezová změna, nejlepší nakonec)

## Technické detaily
- Changelog data jako TypeScript array (žádná DB tabulka)
- Delete account Edge Function musí použít `supabase.auth.admin.deleteUser()`
- Shared dashboard token: `crypto.randomUUID()`
- i18n: `i18next` s `react-i18next`, detekce jazyka z `navigator.language`
