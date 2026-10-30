-- Gemini / Mistral / Groq / xAI "sync" functions were stubs that never imported anything,
-- yet the UI collected and stored those API keys. Stop storing keys we cannot use and delete
-- the ones already stored. Only openrouter / anthropic / openai are supported.


DELETE FROM public.provider_credentials
WHERE provider NOT IN ('openrouter', 'anthropic', 'openai');

-- Replace whichever CHECK constraint(s) currently restrict provider_credentials.provider
-- (20260508120000 and 20260630045312 define different lists; the name is auto-generated).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
    WHERE con.conrelid = 'public.provider_credentials'::regclass
      AND con.contype = 'c'
      AND att.attname = 'provider'
  LOOP
    EXECUTE format('ALTER TABLE public.provider_credentials DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.provider_credentials
  ADD CONSTRAINT provider_credentials_provider_check
  CHECK (provider IN ('openrouter', 'anthropic', 'openai'));

-- Used by the auto-sync scheduler so permanently failing keys are retried at most once per
-- interval and cannot starve healthy credentials. Not exposed to the browser.
ALTER TABLE public.provider_credentials
  ADD COLUMN IF NOT EXISTS last_sync_attempt_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_provider_credentials_due
  ON public.provider_credentials (last_sync_attempt_at NULLS FIRST)
  WHERE enabled;

