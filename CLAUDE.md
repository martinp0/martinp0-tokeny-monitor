# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tokeny is an AI token cost dashboard. Users connect their OpenRouter, Anthropic, or OpenAI accounts and get charts of cost, token usage, latency, and anomalies. Data enters via CSV upload, direct API sync, or an MCP server. The frontend is React + Vite; the backend is **Neon Postgres + Neon Auth (Better Auth) + one Vercel Function** (`api/index.ts` → `server/`), all same-origin under `https://tokeny.martinpohl.cz/api/*`. There is no Supabase anymore.

## Commands

Package manager: **bun** (`bun.lock` is the only lockfile — don't add `package-lock.json`/`bun.lockb`).

```bash
bun install --frozen-lockfile   # install
bun dev                         # dev server (port 8080 via vite.config); /api needs `vercel dev` or a deployed backend
bun run build                   # production build (vite + SSR prerender of the public pages)
bun run lint                    # ESLint
bun run typecheck               # tsc for app, node and server configs
bun run test                    # Vitest (jsdom). NOTE: `bun test` is Bun's own runner — don't use it
bunx vitest run src/test/server-isolation.test.ts   # tenant isolation against PGlite (real Postgres in WASM)
DATABASE_URL=… bun run db:migrate   # apply db/schema.sql (idempotent) to Neon
(cd apple/TokenyKit && swift test)  # native shared code; builds on Linux too
```

CI template: `ci/github-actions-ci.yml` (lint, typecheck, test, build). Deploys are Vercel's Git integration (push to `main` = production).

## Backend (Neon + Vercel)

- **Neon project** `tokeny` (`purple-lab-69702333`, aws-eu-central-1, Free plan). Schema: `db/schema.sql` (single idempotent file, applied with `scripts/db-migrate.mjs`). Users live in `neon_auth."user"` (managed by Neon Auth); every table's `user_id` references it `ON DELETE CASCADE`.
- **No RLS, no Data API.** The only database client is the server, connecting with `DATABASE_URL`. **Every** query that touches user data is in `server/repo.ts` and takes the caller's user id explicitly; functions that cross users say so in their name (`…ForCron`, `…ByShareToken`, `…ByCustomer`, `userIdByMcpToken`). `src/test/server-isolation.test.ts` proves two users can't see each other's rows through any route. Keep it that way when adding endpoints.
- **One function** (Vercel Hobby): `api/index.ts` runs the Hono app from `server/app.ts` (`basePath("/api")`). `vercel.json` rewrites `/api/:path*` → `/api?__path=:path*`; this rewrite must stay first. Don't add more files under `api/`.
- **Cron:** one daily job `/api/cron/daily` (Hobby allows daily only): ČNB USD/CZK rate, Pro auto-sync, budget check (`server/cron.ts`). Protected by `CRON_SECRET` (Vercel sends it as Bearer).
- **Auth** (`server/auth.ts`): `/api/auth/*` is a same-origin proxy to Neon Auth (`@neon/auth/server` `handleAuthProxyRequest`), so session cookies are first-party. A request is authenticated by (1) those cookies, (2) `Authorization: Bearer <Neon Auth JWT>` (verified against the JWKS), or (3) a personal `orm_…` token (sha256 in `mcp_tokens`; MCP and `/api/usage-summary` only). Cookie-authenticated writes from a foreign `Origin` are rejected.
- **Env (Vercel → Production):** `DATABASE_URL` (pooled Neon URL), `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` (≥32 chars), `CREDENTIALS_ENCRYPTION_KEY` (32 bytes base64, AES-256-GCM for provider keys), `CRON_SECRET`, `APP_URL`; optional `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, `STRIPE_TRIAL_DAYS`. Never read the marketplace-injected `POSTGRES_*` / `SUPABASE_*` variables (a test enforces `DATABASE_URL`). Never commit real values; `.env.example` lists the names.
- Public URLs users save stay on the site: `/api/mcp`, `/api/og-dashboard`, `/shared/:token` (`src/lib/public-urls.ts`).
- The old Supabase/Lovable setup and its move are historical: `docs/migrate-off-lovable.md`.

## Environment Variables (frontend)

The frontend needs no backend keys (everything is same-origin `/api`). Optional: `VITE_AUTH_APPLE_ENABLED=true` shows "Continue with Apple" once Apple is configured in Neon Auth.

## Architecture

### Frontend (`src/`)

**Routing** (`src/App.tsx`): React Router with two guard components — `ProtectedRoute` (redirects to `/auth` when no session) and `AuthRoute` (redirects to `/dashboard` when already logged in). Public routes: `/`, `/fun`, `/shared/:token`. Auth: `/auth`, `/auth/callback`, `/reset-password`.

**Auth** (`src/lib/auth-client.ts`, `src/hooks/useAuth.ts`): small fetch client for the Better Auth endpoints under `/api/auth/*` — e-mail + password, Google (and Apple when `VITE_AUTH_APPLE_ENABLED`), password reset by e-mailed OTP code (`/reset-password`). OAuth returns to `/auth/callback` (`src/pages/AuthCallback.tsx`), which loads the session and forwards to `?next=` (same-origin paths only) or `/dashboard`. Trusted domains in Neon Auth: `https://tokeny.martinpohl.cz`, `https://tokeny.pohl.uk`.

**Data flow for the dashboard** (`src/pages/Index.tsx`): everything flows through `useDashboardData()`. That hook loads **all** of the user's `activity_rows` page by page from `GET /api/activity` (the server already applies the free-plan 30-day floor), falls back to a bundled sample CSV in demo mode, and exposes derived values (KPIs, per-model/provider buckets, time series) computed by the pure, unit-tested helpers in `src/lib/aggregations.ts`. All dashboard widgets receive pre-computed props — no component calls the API directly. Filters (date range, selected model) live in the hook and gate all derived values.

**`ActivityRow`** (`src/lib/csv-parser.ts`): the shared type for every data point. OpenRouter CSV rows map 1:1 to this type (`request_count = 1`). Anthropic/OpenAI Admin API rows are time-bucketed aggregates (`request_count > 1`, `generation_time_ms = 0`). Code that computes per-request averages must skip zero-latency rows.

**Currency** (`src/hooks/useCurrency.tsx`): `CurrencyProvider` wraps the app. Exchange rate (USD→CZK) is cached in `localStorage` and hydrated from `GET /api/exchange-rate`. Formatting helpers live in `src/lib/format.ts` (`fmtCost`, `fmtCostShort`, `fmtNum`, `fmtNumShort`) — always pass `currency` and `exchangeRate` from the context.

**i18n** (`src/i18n/`): i18next with Czech (default) and English. Language stored in `localStorage` under key `tokeny_lang`. All user-visible strings should use `useTranslation()`.

**UI components**: shadcn/ui in `src/components/ui/` (do not edit these — regenerate via shadcn CLI if needed). Dashboard widgets live in `src/components/dashboard/`.

### API (`server/app.ts`, all under `/api`)

| Route | Purpose |
|---|---|
| `auth/*` | Neon Auth proxy (sign-in/up, social, get-session, sign-out, email-otp, …) |
| `me`, `profile`, `account/delete` | Profile; account deletion cancels Stripe first, then deletes the Neon Auth user (cascades to all rows) |
| `activity`, `activity/import` | Paged usage rows (free: last 30 days); CSV import in batches of 500, upsert on `(user_id, generation_id)` |
| `credentials`, `credentials/:id/sync` | Provider keys (encrypted with `CREDENTIALS_ENCRYPTION_KEY`, only a masked preview is returned) and user-initiated sync (`server/lib/sync-runner.ts`) |
| `budget-alert`, `mcp-tokens`, `shares` | Pro features (403 `pro_required` for free users) |
| `subscription`, `billing/checkout`, `billing/portal`, `stripe-webhook` | Stripe Pro tier; `subscriptions` is written only by the webhook |
| `chat-agent`, `fun-ai` | AI features (`ANTHROPIC_API_KEY`); chat agent is Pro, data tools scoped to the caller |
| `mcp` | Stateless Streamable-HTTP MCP server (`server/mcp.ts`, `mcp-lite`); `Authorization: Bearer orm_…`, Pro only, every tool scoped to the token owner |
| `usage-summary` | JSON summary for the native apps and widgets (session cookie, JWT or Pro `orm_` token) |
| `shared/:token`, `og-dashboard` | Public share snapshot / OG image (SVG) |
| `exchange-rate`, `health`, `cron/daily` | ČNB rate, health check, daily cron |

Pure, unit-tested logic lives in `server/lib/` (`plan.ts`, `billing.ts`, `sync-core.ts`, `account-deletion.ts`, `credential-keys.ts`); keep it free of I/O.

### Database Schema (key tables, `db/schema.sql`)

- **`activity_rows`**: central fact table. Unique key is **`(user_id, generation_id)`** (synthetic sync ids are identical across users). `created_at` is TEXT (ISO-ish). Aggregate in SQL (`repo.aggregateActivity`). `provider_source` ∈ `{openrouter, anthropic, openai}`. `request_count` is 1 for per-generation rows, N for Admin API bucket rows.
- **`provider_credentials`**: API keys encrypted by the server (AES-256-GCM); only `key_preview` is ever returned.
- **`mcp_tokens`**: personal `orm_` tokens; only the `sha256` hash is stored.
- **`budget_alerts`**, **`shared_dashboards`**, **`subscriptions`**, **`profiles`**, **`exchange_rates`**.
- `public.is_pro(user_id)` mirrors `server/lib/plan.ts`; keep them in sync.

### Key Conventions

- Path alias `@/` maps to `src/` (configured in `vite.config.ts` and `tsconfig.app.json`).
- Frontend calls go through `api()` in `src/lib/api.ts` (same-origin `/api`, cookies included); `ApiError.proRequired` means "show the upgrade modal".
- `provider_source` and `request_count` were added in migration `20260508120000_multi_provider.sql`; older rows default to `openrouter` / `1`. Always use `?? 1` and `?? "openrouter"` when reading these fields from DB rows that may predate the migration (see `useDashboardData.ts`).
- Costs in the database are always in **USD**. Currency conversion happens only at display time via `fmtCost()`.
- There is no RLS: every server query **must** filter by the caller's `user_id` (put it in `server/repo.ts` and add a case to `server-isolation.test.ts`).
- Schema changes: edit `db/schema.sql` idempotently (`IF NOT EXISTS`, `CREATE OR REPLACE`, guarded `ALTER`) and run `bun run db:migrate`.

### Plans & billing (Tokeny Pro)

- **Free:** 1 provider, last 30 days of history, CSV import. **Pro** (99 Kč/měsíc, 990 Kč/rok, nejsem plátce DPH): everything else.
- Plan logic lives in `server/lib/plan.ts` (pure, shared with the frontend via `src/lib/plan.ts`). Pro = status `active | trialing | past_due` and `current_period_end` null or in the future. Enforced on the server (history floor in `repo.historyFloor`, Pro gates in `server/app.ts`, MCP, cron); the UI only mirrors it (`<ProGate feature=…>`).
- A 403 with body `{ error: "pro_required", feature }` means "show the upgrade modal".
- Stripe logic in `server/lib/billing.ts` (unit-tested; handles pre- and post-2025 "basil" shapes). Webhook endpoint: `https://tokeny.martinpohl.cz/api/stripe-webhook`. Customer metadata `tokeny_user_id` (older customers may carry `supabase_user_id`; both are read).
- E-mails (verification, password reset OTP) are sent by Neon Auth itself; the app sends none.
