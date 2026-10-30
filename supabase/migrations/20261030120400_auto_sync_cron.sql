-- Hourly background sync of every user's enabled provider credentials.
--
-- Calls the `auto-sync` edge function via pg_net. The function authenticates the call with the
-- `x-auto-sync-secret` header, whose value is read at run time from Supabase Vault — no secret
-- is stored in this migration.
--
-- PREREQUISITE (manual, once, see PR checklist) — use the SAME random value for both:
--   1. Edge function secret:  AUTO_SYNC_SECRET=<random 32+ chars>
--   2. Vault secret:          select vault.create_secret('<same value>', 'auto_sync_secret');
-- Until the vault secret exists the job sends an empty header and the function answers 401/503
-- (harmless).
--
-- To revert: select cron.unschedule('tokeny-auto-sync');

CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION pg_cron;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tokeny-auto-sync') THEN
    PERFORM cron.unschedule('tokeny-auto-sync');
  END IF;
END $$;

SELECT cron.schedule(
  'tokeny-auto-sync',
  '17 * * * *',
  $cron$
  SELECT net.http_post(
    url     := 'https://cfjusewixhycahgxoylm.supabase.co/functions/v1/auto-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-auto-sync-secret', coalesce(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'auto_sync_secret' LIMIT 1),
        ''
      )
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $cron$
);
