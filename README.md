# 🔮 Tokeny Monitor — OpenRouter Cost Dashboard

[![Live](https://img.shields.io/badge/live-tokeny.pohl.uk-8b5cf6?style=flat-square)](https://tokeny.pohl.uk)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED?style=flat-square&logo=docker)](Dockerfile)
[![Buy Me a Coffee](https://img.shields.io/badge/☕-Buy_Me_a_Coffee-FFDD00?style=flat-square)](https://buymeacoffee.com/martinpohlp)

> Krásný dashboard pro sledování nákladů na AI tokeny z OpenRouteru. CZK & USD, real-life srovnání, MCP server, AI agent — vše v jednom.

---

## ✨ Features

- 📊 **Detailní grafy** — náklady, tokeny, latence, modely, provideři
- 💱 **CZK & USD** — automatický kurz z ČNB, přepínání jedním klikem
- 📁 **CSV import** — stáhni export z OpenRouteru a přetáhni do dashboardu
- ☕ **Real-life srovnání** — kolik káv/piv/pizz za tvoje API náklady
- 🤖 **AI Agent** — ptej se dashboardu přirozeným jazykem
- 🔌 **MCP Server** — připoj Claude Desktop, Cursor nebo Zed
- 🔒 **Bezpečné** — RLS, šifrování, data viditelná jen tobě
- 📱 **PWA** — funguje jako nativní app na iOS i Androidu

## 🚀 Live Demo

👉 **[tokeny.pohl.uk](https://tokeny.pohl.uk)** — live demo s ukázkovými daty, žádná registrace.

---

## 🍴 Fork & Self-Host

Projekt je **open-source** — kdokoliv si ho může forknout a rozjet u sebe!

### Prerekvizity

- Node.js 20+ / Bun
- Supabase projekt (free tier stačí)
- (Volitelně) Docker

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

### 2. Docker (doporučeno pro lokální testování)

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

### Jak na to

1. **Vytvoř 2–3 Supabase projekty** (free tier stačí) — jeden pro dev, staging, prod.

2. **Vytvoř env soubory** pro každé prostředí:

```bash
# .env.development
VITE_SUPABASE_URL=https://dev-xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...dev
VITE_SUPABASE_PROJECT_ID=dev-xxx

# .env.staging
VITE_SUPABASE_URL=https://staging-xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...staging
VITE_SUPABASE_PROJECT_ID=staging-xxx

# .env.production
VITE_SUPABASE_URL=https://prod-xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...prod
VITE_SUPABASE_PROJECT_ID=prod-xxx
```

3. **Spusť/builduj pro konkrétní env:**

```bash
# Dev (výchozí)
bun dev

# Staging build
bun run build -- --mode staging

# Prod build
bun run build
```

4. **CI/CD** — v GitHub Actions nastav secrets pro každé prostředí:

```yaml
# .github/workflows/deploy.yml
jobs:
  deploy-staging:
    environment: staging
    steps:
      - run: npm run build -- --mode staging
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}

  deploy-prod:
    environment: production
    steps:
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}
```

> 💡 **Tip:** Supabase CLI podporuje `supabase link --project-ref <ref>` pro propojení s konkrétním projektem. Migrace pak pouštíš per-env přes `supabase db push`.

---

## 🏗️ Tech Stack

| Vrstva | Technologie |
|--------|-------------|
| Frontend | React 18, TypeScript, Vite 5, Tailwind CSS |
| UI | shadcn/ui, Recharts, Framer Motion |
| Backend | Supabase (Postgres, Auth, Edge Functions, RLS) |
| Mobile | Capacitor (iOS + Android PWA) |
| AI | Lovable AI Gateway (Gemini, GPT) |
| Fonts | Space Grotesk, JetBrains Mono |

---

## 📁 Struktura projektu

```
├── src/
│   ├── components/dashboard/   # Dashboard widgety (grafy, tabulky, KPI)
│   ├── hooks/                  # Custom hooks (auth, currency, data)
│   ├── pages/                  # Landing, Dashboard, Auth, Settings, Fun
│   ├── lib/                    # CSV parser, formátování, utility
│   └── integrations/           # Supabase client & typy
├── supabase/
│   ├── functions/              # Edge Functions (MCP, AI chat, email hook...)
│   └── migrations/             # SQL migrace
├── Dockerfile                  # Multi-stage build
├── docker-compose.yml          # One-command spuštění
└── .env.example                # Šablona env proměnných
```

---

## 🤝 Contributing

1. Forkni repo
2. Vytvoř feature branch (`git checkout -b feature/cool-thing`)
3. Commitni změny (`git commit -m 'Add cool thing'`)
4. Pushni branch (`git push origin feature/cool-thing`)
5. Otevři Pull Request

---

## 📄 License

MIT — dělej si s tím co chceš. Pokud ti to pomáhá, [kup mi kafe ☕](https://buymeacoffee.com/martinpohlp)

---

<p align="center">
  Crafted by <a href="https://martin.pohl.uk">Martin Pohl</a> · 
  <a href="https://tokeny.pohl.uk">Live App</a> · 
  <a href="https://buymeacoffee.com/martinpohlp">Support ☕</a>
</p>
