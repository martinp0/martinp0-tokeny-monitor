-- Checks for 20261030150000_cron_jobs_from_vault.sql (run by run-vault-test.sh).
\set ON_ERROR_STOP 1
DO $$
DECLARE r record; v bigint;
BEGIN
  -- Jobs exist and contain no project ref.
  SELECT * INTO r FROM cron.job WHERE jobname = 'tokeny-auto-sync';
  ASSERT r.command = 'SELECT public.tokeny_kick_auto_sync()', 'auto-sync job command';
  SELECT * INTO r FROM cron.job WHERE jobname = 'process-email-queue';
  ASSERT r.schedule = '5 seconds' AND r.command = 'SELECT public.tokeny_kick_email_queue()', 'email job';
  ASSERT NOT EXISTS (SELECT 1 FROM cron.job WHERE command LIKE '%supabase.co%'), 'no hardcoded URL in jobs';

  -- Without Vault secrets both jobs are no-ops.
  DELETE FROM vault.secrets WHERE name IN ('project_url', 'auto_sync_secret', 'email_queue_service_role_key');
  ASSERT public.tokeny_function_url('auto-sync') IS NULL, 'url null without project_url';
  ASSERT public.tokeny_kick_auto_sync() IS NULL, 'auto-sync skipped without secrets';
  ASSERT public.tokeny_kick_email_queue() IS NULL, 'email skipped without secrets';

  PERFORM vault.create_secret('https://newref.supabase.co/', 'project_url');
  ASSERT public.tokeny_function_url('auto-sync') = 'https://newref.supabase.co/functions/v1/auto-sync', 'url built';
  ASSERT public.tokeny_kick_auto_sync() IS NULL, 'auto-sync still needs its secret';
  PERFORM vault.create_secret('s3cret-value', 'auto_sync_secret');
  v := public.tokeny_kick_auto_sync();
  ASSERT v IS NOT NULL, 'auto-sync posts once configured';

  PERFORM vault.create_secret('service-role-jwt', 'email_queue_service_role_key');
  -- Empty queues -> nothing to do.
  ASSERT public.tokeny_kick_email_queue() IS NULL, 'email skipped when queues are empty';
  INSERT INTO pgmq.q_transactional_emails (message) VALUES ('{}');
  ASSERT public.tokeny_kick_email_queue() IS NOT NULL, 'email posts when mail is waiting';
  -- Rate-limit cooldown -> skip.
  UPDATE public.email_send_state SET retry_after_until = now() + interval '1 minute';
  ASSERT public.tokeny_kick_email_queue() IS NULL, 'email skipped during cooldown';
  UPDATE public.email_send_state SET retry_after_until = NULL;
END $$;

-- Clients cannot call the helpers (they could otherwise read Vault values).
SET ROLE authenticated;
DO $$ BEGIN
  BEGIN PERFORM public.tokeny_vault_secret('project_url'); RAISE EXCEPTION 'authenticated could read vault';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.tokeny_kick_auto_sync(); RAISE EXCEPTION 'authenticated could kick auto-sync';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET ROLE service_role;
DO $$ BEGIN
  BEGIN PERFORM public.tokeny_vault_secret('project_url'); RAISE EXCEPTION 'service_role could read vault via helper';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
\echo 'cron_jobs: all assertions passed'
