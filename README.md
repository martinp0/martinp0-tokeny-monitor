# 🔮 Tokeny — AI Cost Dashboard

[![Live](https://img.shields.io/badge/live-tokeny.pohl.uk-8b5cf6?style=flat-square)](https://tokeny.martinpohl.cz)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED?style=flat-square&logo=docker)](Dockerfile)
[![Buy Me a Coffee](https://img.shields.io/badge/☕-Buy_Me_a_Coffee-FFDD00?style=flat-square)](https://buymeacoffee.com/martinpohlp)

> Open-source dashboard pro sledování nákladů na AI tokeny napříč OpenRouterem, Anthropic Admin API a OpenAI Admin API. CZK & USD, automatický sync, budget alerty, MCP server a AI agent — vše v jednom.

<p align="center">
  <a href="https://tokeny.martinpohl.cz"><strong>🚀 Live demo</strong></a> ·
  <a href="#-fork--self-host"><strong>Self-host</strong></a> ·
  <a href="#-changelog"><strong>Changelog</strong></a> ·
  <a href="https://buymeacoffee.com/martinpohlp"><strong>Support ☕</strong></a>
</p>

---

## Proč Tokeny?

AI API účty umí nenápadně růst. Tokeny ti ukáže, **které modely, provideři, aplikace a klíče stojí peníze** — bez posílání dat do dalšího komerčního SaaS. Nahraj CSV, nebo připoj API credential a nech dashboard synchronizovat náklady automaticky.

## ✨ Features

- 📊 **Detailní dashboard** — náklady, tokeny, requesty, latence, modely, provideři i app/API-key breakdown
- 🔌 **Multi-provider sync** — OpenRouter, Anthropic Admin API a OpenAI Admin API v jednom pohledu
- ⏰ **Denní auto-sync** (Pro) — Vercel Cron spouští sync jednou denně v 05:00 UTC, s per-credential toggle v UI
- 📁 **CSV import** — rychlý import OpenRouter exportu přes drag & drop
- 💱 **CZK & USD** — automatický kurz z ČNB, přepínání jedním klikem
- 🚨 **Budget alerty** — hlídání měsíčního rozpočtu a prahů pro upozornění
- ☕ **Real-life srovnání** — kolik káv/piv/pizz odpovídá tvým API nákladům
- 🤖 **AI agent** — ptej se dashboardu přirozeným jazykem
- 🔗 **MCP server** — připoj Claude Desktop, Cursor nebo Zed a ptej se na náklady přímo v chatu
- 🔒 **Bezpečné základy** — Neon Auth (Better Auth), serverová izolace dat podle uživatele (testovaná), šifrované API klíče
- 📱 **Nativní appky (ve vývoji)** — iPhone s widgety, Mac menu bar, Apple Watch s komplikací a Zkratky; přihlášení přes Apple nebo e-mail ([apple/](apple/README.md))
- 🌐 **PWA** — web jde nainstalovat jako appka na plochu
- 🌐 **SEO/AI discoverability** — sitemap, robots a `llms.txt`

## 🚀 Live Demo

👉 **[tokeny.pohl.uk](https://tokeny.martinpohl.cz)** — live demo s ukázkovými daty, bez nutnosti registrace.

---

## ☕ Support the project

Tokeny je open-source a free to use. Pokud ti ušetří peníze, čas nebo debugování faktur za AI modely, můžeš vývoj podpořit:

<p align="center">
  <a href="https://buymeacoffee.com/martinpohlp">
    <img src="https://img.shields.io/badge/Buy%20me%20a%20coffee-Support%20Tokeny%20Monitor-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=000" alt="Buy Me a Coffee">
  </a>
</p>

Každé kafe pomáhá platit hosting, testování provider API a další vývoj. 🙏

---

## 🍴 Fork & Self-Host

Projekt je **open-source** — kdokoliv si ho může forknout a rozjet u sebe.

### Prerekvizity

- Node.js 20+ / Bun
- [Neon](https://neon.tech) projekt (Free plan stačí) se zapnutým **Neon Auth**
- [Vercel](https://vercel.com) projekt (Hobby stačí): web + jedna serverless funkce `api/index.ts`
- Volitelně Docker (jen statický frontend)

### 1. Klasický setup

```bash
git clone https://github.com/<your-user>/tokeny-monitor.git
cd tokeny-monitor
bun install

# Schéma do Neonu (idempotentní)
DATABASE_URL='postgresql://…' bun run db:migrate

# Frontend + /api lokálně (Vercel CLI načte env z projektu)
vercel dev
```

Frontend sám (`bun dev`, port 8080) běží i bez backendu; přihlášení a data ale potřebují `/api`.

### 2. Backend env (Vercel → Settings → Environment Variables)

| Proměnná | Co to je |
|---|---|
| `DATABASE_URL` | pooled connection string Neon projektu |
| `NEON_AUTH_BASE_URL` | Neon Console → Auth → Auth URL |
| `NEON_AUTH_COOKIE_SECRET` | ≥ 32 náhodných znaků (`openssl rand -base64 32`) |
| `CREDENTIALS_ENCRYPTION_KEY` | 32 bajtů base64 – šifruje API klíče providerů |
| `CRON_SECRET` | náhodný řetězec; Vercel Cron ho posílá jako Bearer |
| `APP_URL` | např. `https://tokeny.martinpohl.cz` |
| `ANTHROPIC_API_KEY` | volitelné – AI agent a AI zábava |
| `STRIPE_*` | volitelné – Pro předplatné (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, `STRIPE_TRIAL_DAYS`) |

V Neon Auth přidej svou doménu do **Trusted domains**. Kompletní seznam je v `.env.example`.

### 3. Docker

```bash
docker compose up --build   # statický frontend přes nginx na :8080 (API běží na Vercelu)
```

---

## 🏗️ Tech Stack

| Vrstva | Technologie |
|--------|-------------|
| Frontend | React 18, TypeScript, Vite 5, Tailwind CSS |
| UI | shadcn/ui, Recharts, Framer Motion, lucide-react |
| Data | Neon Postgres (Free), serverová izolace dat v `server/repo.ts` |
| Backend | Jedna Vercel Function (Hono), Neon Auth (Better Auth), Vercel Cron (denně) |
| Providers | OpenRouter Activity API, Anthropic Admin API, OpenAI Organization Usage/Costs API |
| AI | Anthropic API pro chat/fun agent flows |
| Apple | SwiftUI (iOS/macOS/watchOS 26), WidgetKit, App Intents, XcodeGen + Xcode Cloud |
| Web app | PWA |
| Testing | Vitest, Playwright |
| Fonts | Systémové (SF Pro na Apple), Liquid Glass design |

---

## 📁 Struktura projektu

```
├── src/
│   ├── components/dashboard/   # Dashboard widgety, grafy, tabulky, provider connections
│   ├── hooks/                  # Auth, currency, dashboard data, export
│   ├── pages/                  # Landing, Dashboard, Auth, Settings, Fun, SharedDashboard
│   ├── lib/                    # CSV parser, formátování, utility
│   └── lib/api.ts, auth-client.ts  # same-origin /api klient a Neon Auth klient
├── api/index.ts                # jediná Vercel Function (Hono app ze server/)
├── server/                     # API routy, Neon Auth proxy, MCP, sync, Stripe, cron
├── db/schema.sql               # schéma pro Neon (idempotentní)
├── apple/                      # Nativní appky: iPhone + widgety, Mac menu bar, Watch (XcodeGen, Xcode Cloud)
├── public/                     # PWA assets, SEO, robots, sitemap, llms.txt
├── marketing/                  # Launch copy, blog drafts, screenshots, plan
├── Dockerfile                  # Multi-stage build
├── docker-compose.yml          # One-command spuštění
└── .env.example                # Šablona env proměnných
```

---

## 🧭 Changelog

### Unreleased / recent

- **Backend přepsaný ze Supabase na Neon** (Postgres + Neon Auth) a jednu Vercel Function pod `/api/*`. Nativní appky mluví jen s webovou doménou.
- Added **daily auto-sync** for connected provider credentials via Supabase `pg_cron` and new `auto-sync` Edge Function.
- Added per-credential **Auto-sync denně** toggle and next-run hint in Provider Connections UI.
- Improved OpenRouter sync to support per-user credentials while keeping legacy global-key fallback.
- Auto-sync now processes OpenRouter, Anthropic and OpenAI credentials and updates sync status, errors and imported row counts.
- Added budget-check pass after scheduled syncs.

### 2026-05-10

- Added **multi-provider support**: Anthropic Admin API and OpenAI Admin API alongside OpenRouter.
- Added `provider_credentials` storage with RLS/column protection and dedicated sync Edge Functions.
- Updated dashboard aggregation so OpenAI/Anthropic daily buckets count `request_count` correctly.
- Migrated AI/email flows away from Lovable dependencies to **Anthropic API + Resend**.
- Added marketing plan page and marketing kit content.
- Added SEO/AI crawler assets: sitemap, robots updates and `llms.txt`.

---

## 🤝 Contributing

1. Forkni repo
2. Vytvoř feature branch (`git checkout -b feature/cool-thing`)
3. Commitni změny (`git commit -m 'Add cool thing'`)
4. Pushni branch (`git push origin feature/cool-thing`)
5. Otevři Pull Request

Před PR prosím spusť:

```bash
bun run lint
bun run typecheck
bun run test
bun run build
(cd apple/TokenyKit && swift test)   # pokud měníš nativní kód
```

---

## 📄 License

MIT — dělej si s tím co chceš. Pokud ti to pomáhá, [kup mi kafe ☕](https://buymeacoffee.com/martinpohlp).

---

<p align="center">
  Crafted by <a href="https://martinpohl.cz">Martin Pohl</a> ·
  <a href="https://tokeny.martinpohl.cz">Live App</a> ·
  <a href="https://buymeacoffee.com/martinpohlp">Support ☕</a>
</p>
