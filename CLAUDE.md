# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tokeny Monitor is an AI token cost dashboard. Users connect their OpenRouter, Anthropic, or OpenAI accounts and get charts of cost, token usage, latency, and anomalies. Data enters via CSV upload, direct API sync (edge functions), or an MCP server. The frontend is React + Vite; the backend is entirely Supabase (Postgres, Auth, RLS, Edge Functions).

## Commands

```bash
# Install
bun install          # preferred; npm install also works

# Dev server (port 8080 by default via vite.config)
bun dev

# Production build
bun run build

# Build for staging
bun run build -- --mode staging

# Lint
bun run lint

# Unit tests (Vitest + jsdom)
bun test

# Run a single test file
bun test src/test/example.test.ts

# Watch mode
bun run test:watch

# Docker (builds multi-stage nginx image, runs on :8080)
docker compose up --build
```

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

**Routing** (`src/App.tsx`): React Router with two guard components — `ProtectedRoute` (redirects to `/auth` when no session) and `AuthRoute` (redirects to `/dashboard` when already logged in). Public routes: `/`, `/fun`, `/shared/:token`. Auth: `/auth`, `/reset-password`.

**Data flow for the dashboard** (`src/pages/Index.tsx`): everything flows through `useDashboardData()`. That hook loads from Supabase (`activity_rows` table), falls back to a bundled sample CSV in demo mode, and exposes derived values (KPIs, per-model/provider buckets, time series). All dashboard widgets receive pre-computed props — no component queries Supabase directly. Filters (date range, selected model) live in the hook and gate all derived values.

**`ActivityRow`** (`src/lib/csv-parser.ts`): the shared type for every data point. OpenRouter CSV rows map 1:1 to this type (`request_count = 1`). Anthropic/OpenAI Admin API rows are time-bucketed aggregates (`request_count > 1`, `generation_time_ms = 0`). Code that computes per-request averages must skip zero-latency rows.

**Currency** (`src/hooks/useCurrency.tsx`): `CurrencyProvider` wraps the app. Exchange rate (USD→CZK) is cached in `localStorage` and hydrated from the `exchange_rates` DB table. Formatting helpers live in `src/lib/format.ts` (`fmtCost`, `fmtCostShort`, `fmtNum`, `fmtNumShort`) — always pass `currency` and `exchangeRate` from the context.

**i18n** (`src/i18n/`): i18next with Czech (default) and English. Language stored in `localStorage` under key `tokeny_lang`. All user-visible strings should use `useTranslation()`.

**UI components**: shadcn/ui in `src/components/ui/` (do not edit these — regenerate via shadcn CLI if needed). Dashboard widgets live in `src/components/dashboard/`.

### Backend (Supabase Edge Functions — Deno)

All functions are under `supabase/functions/`. They run on Deno and import from `esm.sh`.

| Function | Purpose |
|---|---|
| `sync-openrouter` | Pulls from OpenRouter `/activity` API; uses `OPENROUTER_API_KEY` secret |
| `sync-anthropic` | Pulls from Anthropic Admin API (`/v1/organizations/usage_report/messages`); needs `credential_id` in body; stores aggregated rows with `provider_source='anthropic'` |
| `sync-openai` | Same pattern as Anthropic for OpenAI Usage API |
| `chat-agent` | Multi-turn AI agent (Lovable AI Gateway → Gemini); handles `query_stats`, `list_models`, `detect_anomalies`, and UI action tools (`apply_filters`, `set_currency`, `export_data`) |
| `mcp` | Streamable MCP server (Hono + `mcp-lite`); authenticates via Bearer token hashed against `mcp_tokens.token_hash`; exposes 7 tools for querying `activity_rows` |
| `check-budget` | Checks monthly spend vs `budget_alerts`, enqueues email if threshold crossed |
| `save-provider-credential` | Writes `api_key` to `provider_credentials` using service role (clients cannot write `api_key` directly due to column-level GRANT) |
| `create-mcp-token` | Generates a random token, stores `sha256(token)` in `mcp_tokens` |
| `get-exchange-rate` | Fetches USD/CZK rate from ČNB, stores in `exchange_rates` |
| `get-shared-dashboard` | Returns filtered `activity_rows` snapshot for a share token |
| `auth-email-hook` | Custom Supabase auth email hook — routes signup/magic-link/recovery emails through the email queue |
| `process-email-queue` | Drains the email queue (Resend API) |

### Database Schema (key tables)

- **`activity_rows`**: central fact table. `generation_id` is the upsert key. `provider_source` ∈ `{openrouter, anthropic, openai}`. `request_count` is 1 for per-generation rows, N for Admin API bucket rows. RLS: users see only their own `user_id` rows.
- **`provider_credentials`**: stores API keys for direct-sync providers. `api_key` column is REVOKED from `authenticated` role — reads/writes must go through the `save-provider-credential` edge function (service role).
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
- The MCP function uses the service role key (no user-scoped RLS filtering) — MCP tools see all rows in the table regardless of `user_id`.
