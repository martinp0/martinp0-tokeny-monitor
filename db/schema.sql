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
