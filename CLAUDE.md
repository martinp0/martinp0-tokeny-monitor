# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tokeny is an AI token cost dashboard. Users connect their OpenRouter, Anthropic, or OpenAI accounts and get charts of cost, token usage, latency, and anomalies. Data enters via CSV upload, direct API sync (edge functions), or an MCP server. The frontend is React + Vite; the backend is entirely Supabase (Postgres, Auth, RLS, Edge Functions).

## Commands

Package manager: **bun** (`bun.lock` is the only lockfile — don't add `package-lock.json`/`bun.lockb`).

```bash
bun install --frozen-lockfile   # install
bun dev                         # dev server (port 8080 via vite.config)
bun run build                   # production build (vite + SSR prerender)
bun run build -- --mode staging # staging build
bun run lint                    # ESLint (src only; supabase/functions is Deno)
bun run typecheck               # tsc for app + node configs
bun run test                    # Vitest (jsdom). NOTE: `bun test` is Bun's own runner — don't use it
bunx vitest run src/test/sync-core.test.ts   # single test file
bun run check:functions         # `deno check` every edge function (needs Deno 2)
docker compose up --build       # multi-stage nginx image on :8080
```

CI (`.github/workflows/ci.yml`, template in `ci/github-actions-ci.yml` until installed) runs lint, typecheck, test, build and the Deno check on every PR. Backend deploys (`supabase db push` + `functions deploy`) go through the manual workflow template `ci/supabase-deploy.yml` (secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`).

SQL tests (need a local Postgres with supabase_vault, pg_cron, pg_net, pgmq): `PGURL=postgres://… supabase/tests/run-vault-test.sh` (Vault keys + cron jobs) and `supabase/tests/run-restore-test.sh` (rehearses the Lovable export → restore → `db push`).

## Backend project (one ref, many files)

The Supabase project ref appears in `.env`, `supabase/config.toml`, `vercel.json` (rewrites), `apple/Config/Backend.xcconfig` and the fallbacks in `AppConfig.swift`. Change it only with `node scripts/set-backend.mjs <ref> <anon-key>`; `src/test/backend-config.test.ts` fails if they disagree or if the ref is hardcoded anywhere else. Never put a service-role / `sb_secret_` key in any of these.

- Public URLs that users save go through the site, not the Supabase host: `https://tokeny.martinpohl.cz/api/mcp` and `/api/og-dashboard` (Vercel rewrites, built by `src/lib/public-urls.ts`).
- Cron jobs read the project URL and their credentials from Vault (`project_url`, `auto_sync_secret`, `email_queue_service_role_key`); without them they no-op. See `20261030150000_cron_jobs_from_vault.sql`.
- The move off Lovable Cloud (export, restore, secrets, auth, Stripe, cutover, rollback) is in `docs/migrate-off-lovable.md`.

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...anon-key
VITE_SUPABASE_PROJECT_ID=your-project-ref
```

Multiple Supabase environments (dev / staging / prod) use separate `.env.development`, `.env.staging`, `.env.production` files and are selected via Vite modes (`--mode staging`, etc.).

## Architecture

### Frontend (`src/`)

**Routing** (`src/App.tsx`): React Router with two guard components — `ProtectedRoute` (redirects to `/auth` when no session) and `AuthRoute` (redirects to `/dashboard` when already logged in). Public routes: `/`, `/fun`, `/shared/:token`. Auth: `/auth`, `/auth/callback`, `/reset-password`.

**Auth**: plain Supabase Auth (no Lovable auth wrapper). Email+password, plus Google/Apple via `supabase.auth.signInWithOAuth({ provider, options: { redirectTo } })`. All redirect URLs are built from `window.location.origin` (`src/lib/auth-redirect.ts`) and land on `/auth/callback` (`src/pages/AuthCallback.tsx`), which waits for the session and forwards to `?next=` (same-origin paths only) or `/dashboard`. Primary domain `https://tokeny.martinpohl.cz` (Vercel), `https://tokeny.pohl.uk` kept transitionally — both must be in Supabase Auth "Redirect URLs".

**Data flow for the dashboard** (`src/pages/Index.tsx`): everything flows through `useDashboardData()`. That hook loads **all** of the user's `activity_rows` page by page (`fetchAllPages`, PostgREST caps responses at 1000 rows — never rely on a single `.select()`), falls back to a bundled sample CSV in demo mode, and exposes derived values (KPIs, per-model/provider buckets, time series) computed by the pure, unit-tested helpers in `src/lib/aggregations.ts`. All dashboard widgets receive pre-computed props — no component queries Supabase directly. Filters (date range, selected model) live in the hook and gate all derived values.

**`ActivityRow`** (`src/lib/csv-parser.ts`): the shared type for every data point. OpenRouter CSV rows map 1:1 to this type (`request_count = 1`). Anthropic/OpenAI Admin API rows are time-bucketed aggregates (`request_count > 1`, `generation_time_ms = 0`). Code that computes per-request averages must skip zero-latency rows.

**Currency** (`src/hooks/useCurrency.tsx`): `CurrencyProvider` wraps the app. Exchange rate (USD→CZK) is cached in `localStorage` and hydrated from the `exchange_rates` DB table. Formatting helpers live in `src/lib/format.ts` (`fmtCost`, `fmtCostShort`, `fmtNum`, `fmtNumShort`) — always pass `currency` and `exchangeRate` from the context.

**i18n** (`src/i18n/`): i18next with Czech (default) and English. Language stored in `localStorage` under key `tokeny_lang`. All user-visible strings should use `useTranslation()`.

**UI components**: shadcn/ui in `src/components/ui/` (do not edit these — regenerate via shadcn CLI if needed). Dashboard widgets live in `src/components/dashboard/`.

### Backend (Supabase Edge Functions — Deno)

All functions are under `supabase/functions/`. They run on Deno and import from `esm.sh`.

| Function | Purpose |
|---|---|
| `sync-openrouter` / `sync-anthropic` / `sync-openai` | User-initiated sync of **one of the caller's own** `provider_credentials` (`{ credential_id }` in body, ownership checked server-side). Thin wrappers around `_shared/user-sync.ts` → `_shared/sync-runner.ts`. No global provider API keys. OpenRouter needs a **Management key** (`GET /api/v1/activity`, last 30 UTC days); Anthropic/OpenAI need Admin keys. |
| `auto-sync` | Hourly background sync of all enabled credentials (pg_cron → pg_net, header `x-auto-sync-secret` = `AUTO_SYNC_SECRET`; `verify_jwt = false`). |
| `chat-agent` | Pro-only AI agent (Anthropic `claude-haiku-4-5`, needs `ANTHROPIC_API_KEY`); 401 without auth, 503 if the key is missing. Data tools use the `activity_aggregate` RPC with the caller's JWT (RLS-scoped). UI action tools: `apply_filters`, `set_currency`, `export_data` |
| `mcp` | Stateless Streamable-HTTP MCP server (Hono + `mcp-lite` 0.10: `mcp.tool(name, def)`, `transport.bind(mcp)`). Logic in `mcp/app.ts` (`createMcpApp(deps)`, tested by `mcp/app.test.ts` via `deno test`, run in `check:functions`); `index.ts` only wires Supabase. Static `Authorization: Bearer <token>` hashed against `mcp_tokens.token_hash` (no OAuth); GET/DELETE → 405; 401 carries `WWW-Authenticate`; Pro only. Every tool is scoped to the token owner's `user_id`, aggregates in SQL, and has read-only/destructive annotations. Client setup guides (Grok Bot, Cursor, Claude Code, Claude Desktop): `src/components/settings/McpClientGuides.tsx` |
| `usage-summary` | JSON summary for the native apps and widgets. Accepts a Supabase user JWT (free plan clamped to 30 days, no forecast) or a Pro `orm_` token |
| `check-budget` | Checks monthly spend vs `budget_alerts` (service-role JWT only) |
| `save-provider-credential` | Stores the key encrypted in Supabase Vault via the `save_provider_credential` RPC (service role only); the row keeps `api_key_secret_id` + a masked `key_preview`. Only `openrouter`, `anthropic`, `openai` are accepted |
| `create-mcp-token` | Generates a random token, stores `sha256(token)` in `mcp_tokens` |
| `get-exchange-rate` | Fetches USD/CZK rate from ČNB, stores in `exchange_rates` |
| `get-shared-dashboard` / `og-dashboard` | Public share-token snapshot (paged, max 50k rows) / OG image (SQL aggregate) |
| `stripe-webhook` / `create-checkout` / `check-subscription` | Stripe Pro tier; `subscriptions` is written only by the webhook (service role) |
| `auth-email-hook` / `process-email-queue` | Custom auth emails via the email queue (Resend) |

Shared code lives in `supabase/functions/_shared/`. `sync-core.ts` and `paginate.ts` are **pure** (no Deno/URL imports) so Vitest can import them (`src/test/sync-core.test.ts`); keep them that way.

### Database Schema (key tables)

- **`activity_rows`**: central fact table. Unique key is **`(user_id, generation_id)`** — every upsert must use `onConflict: "user_id,generation_id"` (synthetic sync ids are identical across users). `created_at` is TEXT (ISO-ish). Aggregate with the `activity_aggregate(p_user_id, p_from, p_to, p_model, p_provider, p_group_by)` RPC (security invoker, RLS applies). `provider_source` ∈ `{openrouter, anthropic, openai}`. `request_count` is 1 for per-generation rows, N for Admin API bucket rows. RLS: users see only their own `user_id` rows.
- **`provider_credentials`**: stores API keys for direct-sync providers (`openrouter`, `anthropic`, `openai` only). Keys are encrypted at rest in Supabase Vault (`api_key_secret_id` → `vault.secrets`); there is no plaintext column. Only `service_role` can call `save_provider_credential` / `get_provider_credential_key` / `delete_provider_credentials` (helpers in `supabase/functions/_shared/credential-keys.ts`). `authenticated` can SELECT metadata columns, UPDATE label/enabled/organization_id and DELETE its own rows (an AFTER DELETE trigger drops the Vault secret); it cannot INSERT. SQL tests: `PGURL=postgres://… ./supabase/tests/run-vault-test.sh` (needs Postgres with the supabase_vault extension).
- **`mcp_tokens`**: MCP bearer tokens. Only the `sha256` hash is stored.
- **`budget_alerts`**: one row per user, monthly budget + email threshold.
- **`shared_dashboards`**: share tokens with optional expiry and filters blob.
- **`exchange_rates`**: single cached USD→CZK rate row.

All tables have RLS enabled. Migrations live in `supabase/migrations/` in chronological order.

### Key Conventions

- Path alias `@/` maps to `src/` (configured in `vite.config.ts` and `tsconfig.app.json`).
- Import the Supabase client from `@/integrations/supabase/client` — never construct a new client in frontend code.
- `provider_source` and `request_count` were added in migration `20260508120000_multi_provider.sql`; older rows default to `openrouter` / `1`. Always use `?? 1` and `?? "openrouter"` when reading these fields from DB rows that may predate the migration (see `useDashboardData.ts`).
- Costs in the database are always in **USD**. Currency conversion happens only at display time via `fmtCost()`.
- Edge functions that use the service role key **must** filter by the authenticated user's `user_id` themselves (RLS does not apply to service role). The MCP server, sync functions and `usage-summary` do.
- Never read more than 1000 rows with one PostgREST request: aggregate in SQL (`activity_aggregate`) or page with `fetchAllPages` and a deterministic order (`created_at`, `id`).
- Migrations: never edit or rename an applied migration; add a new corrective one (see `20261030120300_subscriptions_consolidate.sql`).

### Plans & billing (Tokeny Pro)

- **Free:** 1 provider, last 30 days of history, CSV import (old rows are dropped client-side; RLS hides them anyway). **Pro** (99 Kč/měsíc, 990 Kč/rok, nejsem plátce DPH): everything else.
- Plan logic lives in `supabase/functions/_shared/plan.ts` (pure, shared with the frontend via `src/lib/plan.ts`). Pro = status `active | trialing | past_due` and `current_period_end` null or in the future. Keep SQL `public.is_pro()` (migration `20261030130000_pro_entitlements.sql`) in sync with it.
- Enforcement map — DB/RLS: `activity_rows` SELECT (30 days for free), `budget_alerts` / `shared_dashboards` insert+update, `mcp_tokens` insert, `auto_sync_due_credentials()` (Pro only). Edge functions: `save-provider-credential`, `_shared/user-sync.ts`, `check-budget`, `create-mcp-token`, `mcp`, `usage-summary`, `chat-agent`, `get-shared-dashboard`, `og-dashboard`. UI only: PNG/PDF export (client-side), `<ProGate feature=…>`.
- A 403 with body `{ error: "pro_required", feature }` means "show the upgrade modal".
- Stripe: `create-checkout` (body `{ interval: "month" | "year" }`), `create-portal-session`, `check-subscription`, `stripe-webhook` (logic in `_shared/billing.ts`, unit-tested; handles both pre- and post-2025 "basil" shapes where period fields live on subscription items).
- Function secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, `STRIPE_TRIAL_DAYS` (optional, first subscription only), `APP_URL`; auth emails: `SEND_EMAIL_HOOK_SECRET` (`v1,whsec_…`), `RESEND_API_KEY`.
