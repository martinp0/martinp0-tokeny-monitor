# 🔮 Tokeny Monitor — AI Cost Dashboard

[![Live](https://img.shields.io/badge/live-tokeny.pohl.uk-8b5cf6?style=flat-square)](https://tokeny.pohl.uk)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED?style=flat-square&logo=docker)](Dockerfile)
[![Buy Me a Coffee](https://img.shields.io/badge/☕-Buy_Me_a_Coffee-FFDD00?style=flat-square)](https://buymeacoffee.com/martinpohlp)

> Open-source dashboard pro sledování nákladů na AI tokeny napříč OpenRouterem, Anthropic Admin API a OpenAI Admin API. CZK & USD, automatický sync, budget alerty, MCP server a AI agent — vše v jednom.

<p align="center">
  <a href="https://tokeny.pohl.uk"><strong>🚀 Live demo</strong></a> ·
  <a href="#-fork--self-host"><strong>Self-host</strong></a> ·
  <a href="#-changelog"><strong>Changelog</strong></a> ·
  <a href="https://buymeacoffee.com/martinpohlp"><strong>Support ☕</strong></a>
</p>

---

## Proč Tokeny Monitor?

AI API účty umí nenápadně růst. Tokeny Monitor ti ukáže, **které modely, provideři, aplikace a klíče stojí peníze** — bez posílání dat do dalšího komerčního SaaS. Nahraj CSV, nebo připoj API credential a nech dashboard synchronizovat náklady automaticky.

## ✨ Features

- 📊 **Detailní dashboard** — náklady, tokeny, requesty, latence, modely, provideři i app/API-key breakdown
- 🔌 **Multi-provider sync** — OpenRouter, Anthropic Admin API a OpenAI Admin API v jednom pohledu
- ⏰ **Denní auto-sync** — Supabase cron spouští sync každý den v 06:00 UTC, s per-credential toggle v UI
- 📁 **CSV import** — rychlý import OpenRouter exportu přes drag & drop
- 💱 **CZK & USD** — automatický kurz z ČNB, přepínání jedním klikem
- 🚨 **Budget alerty** — hlídání měsíčního rozpočtu a prahů pro upozornění
- ☕ **Real-life srovnání** — kolik káv/piv/pizz odpovídá tvým API nákladům
- 🤖 **AI agent** — ptej se dashboardu přirozeným jazykem
- 🔗 **MCP server** — připoj Claude Desktop, Cursor nebo Zed a ptej se na náklady přímo v chatu
- 🔒 **Bezpečné základy** — Supabase Auth, RLS, Edge Functions a izolace dat podle uživatele
- 📱 **PWA + mobile** — funguje jako webová i instalovatelná appka, připraveno pro Capacitor
- 🌐 **SEO/AI discoverability** — sitemap, robots a `llms.txt`

## 🚀 Live Demo

👉 **[tokeny.pohl.uk](https://tokeny.pohl.uk)** — live demo s ukázkovými daty, bez nutnosti registrace.

---

## ☕ Support the project

Tokeny Monitor je open-source a free to use. Pokud ti ušetří peníze, čas nebo debugování faktur za AI modely, můžeš vývoj podpořit:

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
- Supabase projekt (free tier stačí pro lokální testování)
- Supabase CLI, pokud chceš deployovat Edge Functions a migrace
- Volitelně Docker

### 1. Klasický setup

```bash
# Klonuj repo
git clone https://github.com/<your-user>/tokeny-monitor.git
cd tokeny-monitor

# Nainstaluj závislosti
bun install   # nebo npm install

# Zkopíruj env šablonu
cp .env.example .env
# Vyplň VITE_SUPABASE_URL a VITE_SUPABASE_PUBLISHABLE_KEY

# Spusť dev server
bun dev       # nebo npm run dev
```

Otevři [http://localhost:8080](http://localhost:8080).

### 2. Supabase setup

```bash
# Připoj projekt
supabase link --project-ref <your-project-ref>

# Nahraj SQL migrace
supabase db push

# Nastav secrets pro Edge Functions
supabase secrets set \
  ANTHROPIC_API_KEY=sk-ant-... \
  RESEND_API_KEY=re_... \
  SUPABASE_AUTH_HOOK_SECRET=...

# Deployni functions podle potřeby
supabase functions deploy save-provider-credential
supabase functions deploy sync-openrouter
supabase functions deploy sync-anthropic
supabase functions deploy sync-openai
supabase functions deploy auto-sync
supabase functions deploy chat-agent
supabase functions deploy mcp
```

> Auto-sync používá `pg_cron` + `pg_net` a volá Edge Function `auto-sync` denně v 06:00 UTC. U self-hostu zkontroluj URL v cron migraci a případně ji uprav pro svůj Supabase projekt.

### 3. Docker

```bash
# Build & spuštění
docker compose up --build

# Nebo jen Docker
docker build -t tokeny-monitor .
docker run -p 8080:80 \
  -e VITE_SUPABASE_URL=https://xxx.supabase.co \
  -e VITE_SUPABASE_PUBLISHABLE_KEY=eyJ... \
  tokeny-monitor
```

Otevři [http://localhost:8080](http://localhost:8080).

---

## 🌍 Environments: Dev / Staging / Prod

Projekt podporuje oddělené prostředí přes Vite **modes** a samostatné Supabase projekty:

| Prostředí | Vite Mode | Env soubor | Supabase projekt |
|-----------|-----------|------------|------------------|
| **Dev** | `development` | `.env.development` | `dev-xxx.supabase.co` |
| **Staging** | `staging` | `.env.staging` | `staging-xxx.supabase.co` |
| **Prod** | `production` | `.env.production` | `prod-xxx.supabase.co` |

```bash
# Dev (výchozí)
bun dev

# Staging build
bun run build -- --mode staging

# Prod build
bun run build
```

> 💡 Supabase CLI podporuje `supabase link --project-ref <ref>` pro propojení s konkrétním projektem. Migrace pak pouštíš per-env přes `supabase db push`.

---

## 🏗️ Tech Stack

| Vrstva | Technologie |
|--------|-------------|
| Frontend | React 18, TypeScript, Vite 5, Tailwind CSS |
| UI | shadcn/ui, Recharts, Framer Motion, lucide-react |
| Data | Supabase Postgres, RLS, generated TS types |
| Backend | Supabase Edge Functions, Auth hooks, pg_cron/pg_net |
| Providers | OpenRouter Activity API, Anthropic Admin API, OpenAI Organization Usage/Costs API |
| AI | Anthropic API pro chat/fun agent flows |
| Email | Resend přes Supabase email queue |
| Mobile | PWA + Capacitor |
| Testing | Vitest, Playwright |
| Fonts | Space Grotesk, JetBrains Mono |

---

## 📁 Struktura projektu

```
├── src/
│   ├── components/dashboard/   # Dashboard widgety, grafy, tabulky, provider connections
│   ├── hooks/                  # Auth, currency, dashboard data, export
│   ├── pages/                  # Landing, Dashboard, Auth, Settings, Fun, SharedDashboard
│   ├── lib/                    # CSV parser, formátování, utility
│   └── integrations/           # Supabase client & typy
├── supabase/
│   ├── functions/              # MCP, AI chat, provider sync, email hook, auto-sync
│   └── migrations/             # SQL migrace včetně multi-provider a cron setupu
├── public/                     # PWA assets, SEO, robots, sitemap, llms.txt
├── marketing/                  # Launch copy, blog drafts, screenshots, plan
├── Dockerfile                  # Multi-stage build
├── docker-compose.yml          # One-command spuštění
└── .env.example                # Šablona env proměnných
```

---

## 🧭 Changelog

### Unreleased / recent

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
bun run build
bun run lint
bun run test
```

---

## 📄 License

MIT — dělej si s tím co chceš. Pokud ti to pomáhá, [kup mi kafe ☕](https://buymeacoffee.com/martinpohlp).

---

<p align="center">
  Crafted by <a href="https://martin.pohl.uk">Martin Pohl</a> ·
  <a href="https://tokeny.pohl.uk">Live App</a> ·
  <a href="https://buymeacoffee.com/martinpohlp">Support ☕</a>
</p>
