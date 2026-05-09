-- Multi-provider support: Anthropic + OpenAI direct API alongside OpenRouter
-- - Adds provider_source column to activity_rows
-- - Creates provider_credentials table with column-level api_key protection
-- - Adds aggregated-row support (request_count) since Admin/Usage APIs return buckets

-- ============================================================
-- 1. activity_rows extensions
-- ============================================================
ALTER TABLE public.activity_rows
  ADD COLUMN IF NOT EXISTS provider_source TEXT NOT NULL DEFAULT 'openrouter'
    CHECK (provider_source IN ('openrouter', 'anthropic', 'openai'));

-- For Admin/Usage APIs that return time-bucket aggregates, one DB row may represent
-- many real requests. For per-generation OpenRouter rows this stays 1.
ALTER TABLE public.activity_rows
  ADD COLUMN IF NOT EXISTS request_count INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_activity_provider_source
  ON public.activity_rows (provider_source);

CREATE INDEX IF NOT EXISTS idx_activity_user_id
  ON public.activity_rows (user_id);

-- ============================================================
-- 2. provider_credentials table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.provider_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('openrouter', 'anthropic', 'openai')),
  label TEXT NOT NULL DEFAULT 'Default',
  -- The full key. Never sent back to the browser (column-level GRANT below).
  api_key TEXT NOT NULL,
  -- Last 4 chars + masked prefix, safe to expose in UI.
  key_preview TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  -- Anthropic/OpenAI Admin keys can target a specific organization/workspace.
  organization_id TEXT,
  -- Sync state
  last_synced_at TIMESTAMPTZ,
  last_sync_status TEXT CHECK (last_sync_status IN ('ok', 'error', 'running')),
  last_sync_error TEXT,
  rows_imported INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, label)
);

ALTER TABLE public.provider_credentials ENABLE ROW LEVEL SECURITY;

-- Owner can read metadata (api_key column blocked by GRANT below).
DROP POLICY IF EXISTS "Owner reads own credentials" ON public.provider_credentials;
CREATE POLICY "Owner reads own credentials"
  ON public.provider_credentials FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Inserts go through the save-provider-credential edge function (service role).
-- We keep an authenticated INSERT policy as a fallback for SDK calls — the column
-- GRANT still prevents the client from re-reading the api_key after insert.
DROP POLICY IF EXISTS "Owner writes own credentials" ON public.provider_credentials;
CREATE POLICY "Owner writes own credentials"
  ON public.provider_credentials FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owner updates own credentials" ON public.provider_credentials;
CREATE POLICY "Owner updates own credentials"
  ON public.provider_credentials FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owner deletes own credentials" ON public.provider_credentials;
CREATE POLICY "Owner deletes own credentials"
  ON public.provider_credentials FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full credentials" ON public.provider_credentials;
CREATE POLICY "Service role full credentials"
  ON public.provider_credentials FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Column-level lockdown: clients cannot read or write api_key directly.
-- Inserts/updates of api_key MUST go through the save-provider-credential edge
-- function (which uses service_role).
REVOKE ALL ON public.provider_credentials FROM authenticated;
GRANT SELECT (
  id, user_id, provider, label, key_preview, enabled, organization_id,
  last_synced_at, last_sync_status, last_sync_error, rows_imported,
  created_at, updated_at
) ON public.provider_credentials TO authenticated;
GRANT INSERT (
  id, user_id, provider, label, key_preview, enabled, organization_id
) ON public.provider_credentials TO authenticated;
GRANT UPDATE (
  label, enabled, organization_id, updated_at
) ON public.provider_credentials TO authenticated;
GRANT DELETE ON public.provider_credentials TO authenticated;

CREATE INDEX IF NOT EXISTS idx_provider_credentials_user
  ON public.provider_credentials (user_id);
CREATE INDEX IF NOT EXISTS idx_provider_credentials_provider
  ON public.provider_credentials (user_id, provider);

-- updated_at auto-update
DROP TRIGGER IF EXISTS provider_credentials_updated ON public.provider_credentials;
CREATE TRIGGER provider_credentials_updated
  BEFORE UPDATE ON public.provider_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
