-- Tokeny – consolidated schema for Neon Postgres (replaces supabase/migrations/*).
--
-- Authorization model: there is NO Data API and NO row-level security on these tables. The only
-- client is the server (api/ → server/), which connects with the owner role and scopes EVERY query
-- by the signed-in user's id (see server/repo.ts; isolation is tested in src/test/server-isolation.test.ts).
-- Users live in neon_auth."user" (Neon Auth / Better Auth); deleting a user there cascades here.
--
-- Idempotent: safe to run again (CREATE … IF NOT EXISTS / CREATE OR REPLACE).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------- activity rows (usage data)
CREATE TABLE IF NOT EXISTS public.activity_rows (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  generation_id            text NOT NULL,
  created_at               text NOT NULL,           -- ISO-8601 (UTC) as delivered by the providers
  cost_total               double precision NOT NULL DEFAULT 0,
  cost_web_search          double precision NOT NULL DEFAULT 0,
  cost_cache               double precision NOT NULL DEFAULT 0,
  cost_file_processing     double precision NOT NULL DEFAULT 0,
  byok_usage_inference     double precision NOT NULL DEFAULT 0,
  tokens_prompt            integer NOT NULL DEFAULT 0,
  tokens_completion        integer NOT NULL DEFAULT 0,
  tokens_reasoning         integer NOT NULL DEFAULT 0,
  tokens_cached            integer NOT NULL DEFAULT 0,
  tokens_cache_write       bigint NOT NULL DEFAULT 0,
  model_permaslug          text NOT NULL DEFAULT '',
  provider_name            text NOT NULL DEFAULT '',
  variant                  text NOT NULL DEFAULT '',
  cancelled                boolean NOT NULL DEFAULT false,
  streamed                 boolean NOT NULL DEFAULT false,
  "user"                   text NOT NULL DEFAULT '',
  finish_reason_raw        text NOT NULL DEFAULT '',
  finish_reason_normalized text NOT NULL DEFAULT '',
  generation_time_ms       double precision NOT NULL DEFAULT 0,
  time_to_first_token_ms   double precision NOT NULL DEFAULT 0,
  app_name                 text NOT NULL DEFAULT '',
  api_key_name             text NOT NULL DEFAULT '',
  provider_source          text NOT NULL DEFAULT 'openrouter',
  request_count            integer NOT NULL DEFAULT 1,
  billing_type             text,
  inserted_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_rows_user_generation_key UNIQUE (user_id, generation_id),
  CONSTRAINT activity_rows_provider_source_check CHECK (provider_source IN
    ('openrouter', 'anthropic', 'openai', 'gemini', 'mistral', 'groq', 'xai', 'cursor', 'grok-bot')),
  CONSTRAINT activity_rows_billing_type_check CHECK (billing_type IS NULL OR billing_type IN ('included', 'on_demand', 'credits'))
);
CREATE INDEX IF NOT EXISTS idx_activity_rows_user_created ON public.activity_rows (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_rows_user_model ON public.activity_rows (user_id, model_permaslug);
CREATE INDEX IF NOT EXISTS idx_activity_rows_user_source ON public.activity_rows (user_id, provider_source);

-- ---------------------------------------------------------------- exchange rates (public, no user data)
CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_pair text NOT NULL UNIQUE,
  rate          numeric NOT NULL,
  source_date   text,
  fetched_at    timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.exchange_rates (currency_pair, rate, source_date)
VALUES ('USD_CZK', 23.5, 'fallback')
ON CONFLICT (currency_pair) DO NOTHING;

-- ---------------------------------------------------------------- profiles (created lazily by the API)
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL UNIQUE REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  display_name text,
  avatar_url   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- budget alerts (Pro to write)
CREATE TABLE IF NOT EXISTS public.budget_alerts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL UNIQUE REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  monthly_budget_usd numeric NOT NULL DEFAULT 50,
  notify_email       text,
  threshold_pct      integer NOT NULL DEFAULT 80,
  last_notified_at   timestamptz,
  enabled            boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Budget in the user's chosen currency (compared in USD at the ČNB rate), several thresholds,
-- optional per-provider budgets (provider_source → amount). monthly_budget_usd/threshold_pct are
-- kept in sync for older readers (usage summary / MCP). notify_email is legacy: no e-mail is sent.
ALTER TABLE public.budget_alerts ADD COLUMN IF NOT EXISTS budget_amount numeric;
ALTER TABLE public.budget_alerts ADD COLUMN IF NOT EXISTS budget_currency text NOT NULL DEFAULT 'USD';
ALTER TABLE public.budget_alerts ADD COLUMN IF NOT EXISTS thresholds integer[] NOT NULL DEFAULT '{50,80,100}';
ALTER TABLE public.budget_alerts ADD COLUMN IF NOT EXISTS forecast_alert boolean NOT NULL DEFAULT true;
ALTER TABLE public.budget_alerts ADD COLUMN IF NOT EXISTS provider_budgets jsonb NOT NULL DEFAULT '{}'::jsonb;
UPDATE public.budget_alerts SET budget_amount = monthly_budget_usd, thresholds = ARRAY[threshold_pct]
 WHERE budget_amount IS NULL;
ALTER TABLE public.budget_alerts DROP CONSTRAINT IF EXISTS budget_alerts_currency_check;
ALTER TABLE public.budget_alerts ADD CONSTRAINT budget_alerts_currency_check CHECK (budget_currency IN ('USD', 'CZK'));

-- ---------------------------------------------------------------- in-app budget alerts (written by the daily cron)
-- One row per (month, kind, scope, threshold): the unique key is the dedupe, the cron may rerun.
CREATE TABLE IF NOT EXISTS public.budget_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  period        text NOT NULL,                       -- 'YYYY-MM' (UTC)
  kind          text NOT NULL CHECK (kind IN ('threshold', 'forecast')),
  scope         text NOT NULL DEFAULT 'total',       -- 'total' or a provider_source
  threshold_pct integer NOT NULL DEFAULT 0,          -- 0 for forecast alerts
  spent_usd     double precision NOT NULL DEFAULT 0,
  budget_usd    double precision NOT NULL DEFAULT 0,
  forecast_usd  double precision,
  read_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT budget_events_dedupe_key UNIQUE (user_id, period, kind, scope, threshold_pct)
);
CREATE INDEX IF NOT EXISTS idx_budget_events_user_created ON public.budget_events (user_id, created_at DESC);

-- ---------------------------------------------------------------- personal API / MCP tokens (sha256 only)
CREATE TABLE IF NOT EXISTS public.mcp_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  token_hash   text NOT NULL UNIQUE,
  name         text NOT NULL DEFAULT 'MCP Token',
  last_used_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mcp_tokens_user ON public.mcp_tokens (user_id);

-- ---------------------------------------------------------------- shared dashboards (Pro to create)
CREATE TABLE IF NOT EXISTS public.shared_dashboards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  share_token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  filters     jsonb NOT NULL DEFAULT '{}'::jsonb,
  label       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_shared_dashboards_user ON public.shared_dashboards (user_id);
-- Share links v2: the token is shown once and only its SHA-256 is stored; revocation keeps the row
-- so the public page can answer 410 instead of 404. `filters` holds the validated scope.
ALTER TABLE public.shared_dashboards ADD COLUMN IF NOT EXISTS token_hash text;
ALTER TABLE public.shared_dashboards ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
ALTER TABLE public.shared_dashboards ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.shared_dashboards ADD COLUMN IF NOT EXISTS last_viewed_at timestamptz;
ALTER TABLE public.shared_dashboards ALTER COLUMN share_token DROP NOT NULL;
ALTER TABLE public.shared_dashboards ALTER COLUMN share_token DROP DEFAULT;
UPDATE public.shared_dashboards SET token_hash = encode(sha256(convert_to(share_token, 'UTF8')), 'hex')
 WHERE token_hash IS NULL AND share_token IS NOT NULL;
UPDATE public.shared_dashboards SET share_token = NULL WHERE share_token IS NOT NULL AND token_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS shared_dashboards_token_hash_key ON public.shared_dashboards (token_hash);

-- Fixed-window rate limits for public endpoints. Keys are HMACs (never raw IPs); rows older than a
-- day are deleted by the daily cron.
CREATE TABLE IF NOT EXISTS public.rate_limits (
  bucket       text NOT NULL,
  window_start timestamptz NOT NULL,
  hits         integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);

-- ---------------------------------------------------------------- provider credentials
-- api_key_ciphertext = AES-256-GCM (server env CREDENTIALS_ENCRYPTION_KEY), format "v1:<iv b64>:<ct+tag b64>".
-- The key never leaves the server; the UI only ever sees key_preview (bullets + last 4).
CREATE TABLE IF NOT EXISTS public.provider_credentials (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  provider             text NOT NULL,
  label                text NOT NULL DEFAULT 'Default',
  api_key_ciphertext   text NOT NULL,
  key_preview          text NOT NULL DEFAULT '••••',
  enabled              boolean NOT NULL DEFAULT true,
  organization_id      text,
  last_synced_at       timestamptz,
  last_sync_attempt_at timestamptz,
  last_sync_status     text,
  last_sync_error      text,
  rows_imported        integer NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_credentials_user_provider_label_key UNIQUE (user_id, provider, label),
  CONSTRAINT provider_credentials_provider_check CHECK (provider IN ('openrouter', 'anthropic', 'openai')),
  CONSTRAINT provider_credentials_status_check CHECK (last_sync_status IS NULL OR last_sync_status IN ('ok', 'error', 'running'))
);
CREATE INDEX IF NOT EXISTS idx_provider_credentials_due
  ON public.provider_credentials (last_sync_attempt_at NULLS FIRST) WHERE enabled;

-- ---------------------------------------------------------------- Stripe subscriptions (written by the webhook only)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL UNIQUE REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  stripe_customer_id     text NOT NULL,
  stripe_subscription_id text UNIQUE,
  price_id               text,
  status                 text NOT NULL DEFAULT 'inactive',
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_status_check CHECK (status IN ('active', 'trialing', 'past_due', 'canceled',
    'incomplete', 'incomplete_expired', 'unpaid', 'paused', 'inactive'))
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON public.subscriptions (stripe_customer_id);

-- ---------------------------------------------------------------- the user's own AI key (BYOK)
-- AI features (chat agent, Fun page) call the provider with the caller's own key, never a shared
-- server key. Encrypted like provider_credentials (server/crypto.ts v1, AAD = user id).
CREATE TABLE IF NOT EXISTS public.ai_keys (
  user_id            uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  provider           text NOT NULL,
  api_key_ciphertext text NOT NULL,
  key_preview        text NOT NULL DEFAULT '••••',
  last_used_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, provider),
  CONSTRAINT ai_keys_provider_check CHECK (provider IN ('anthropic', 'openai', 'openrouter'))
);
-- Widen the provider list on databases created before OpenAI / OpenRouter were added.
ALTER TABLE public.ai_keys DROP CONSTRAINT IF EXISTS ai_keys_provider_check;
ALTER TABLE public.ai_keys ADD CONSTRAINT ai_keys_provider_check CHECK (provider IN ('anthropic', 'openai', 'openrouter'));

-- Which of the user's own keys the AI features use, and with which model.
CREATE TABLE IF NOT EXISTS public.ai_settings (
  user_id    uuid PRIMARY KEY REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  provider   text NOT NULL CHECK (provider IN ('anthropic', 'openai', 'openrouter')),
  model      text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Same rule as server/lib/plan.ts isProSubscription().
CREATE OR REPLACE FUNCTION public.is_pro(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = p_user_id
      AND s.status IN ('active', 'trialing', 'past_due')
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  );
$$;

-- Nothing in public is reachable by roles other than the owner (no Data API is enabled, this is
-- defence in depth in case it ever is).
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
