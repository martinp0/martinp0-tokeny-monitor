-- Background jobs that call edge functions, without a hardcoded project ref.
--
-- Before: the auto-sync job had the Lovable Cloud project URL baked into its command,
-- and the email-queue job existed only on Lovable Cloud (created through its API, never in a
-- migration). Moving the backend to another Supabase project would silently break both.
--
-- Now both jobs call small SQL functions that read everything at run time from Supabase Vault:
--   project_url                   https://<ref>.supabase.co   (no trailing slash needed)
--   auto_sync_secret              same value as the AUTO_SYNC_SECRET edge function secret
--   email_queue_service_role_key  the project's service_role key (legacy JWT; the function
--                                 checks the role claim)
-- Set them once per project (see docs/migrate-off-lovable.md):
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
-- While a secret is missing the job does nothing (returns NULL) instead of calling a wrong URL.
--
-- To revert: select cron.unschedule('tokeny-auto-sync'); select cron.unschedule('process-email-queue');
--            drop function public.tokeny_function_url(text), public.tokeny_kick_auto_sync(),
--                          public.tokeny_kick_email_queue();

CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault CASCADE;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION pg_cron;
  END IF;
END $$;

-- Reads one Vault secret by name; NULL when missing or empty.
CREATE OR REPLACE FUNCTION public.tokeny_vault_secret(p_name text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT nullif(btrim(ds.decrypted_secret), '')
  FROM vault.decrypted_secrets ds
  WHERE ds.name = p_name
  ORDER BY ds.created_at DESC
  LIMIT 1;
$$;

-- https://<ref>.supabase.co/functions/v1/<fn>, or NULL while project_url is not set.
CREATE OR REPLACE FUNCTION public.tokeny_function_url(p_function text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT rtrim(u, '/') || '/functions/v1/' || p_function
  FROM (SELECT public.tokeny_vault_secret('project_url') AS u) s
  WHERE u IS NOT NULL;
$$;

-- Hourly: POST auto-sync with the shared secret. Returns the pg_net request id, or NULL if skipped.
CREATE OR REPLACE FUNCTION public.tokeny_kick_auto_sync()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url text := public.tokeny_function_url('auto-sync');
  v_secret text := public.tokeny_vault_secret('auto_sync_secret');
BEGIN
  IF v_url IS NULL OR v_secret IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-auto-sync-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
END;
$$;

-- Every 5 seconds: wake process-email-queue, but only when there is mail waiting and the sender is
-- not in a rate-limit cooldown (mirrors the job Lovable created for its email infrastructure).
CREATE OR REPLACE FUNCTION public.tokeny_kick_email_queue()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url text := public.tokeny_function_url('process-email-queue');
  v_key text := public.tokeny_vault_secret('email_queue_service_role_key');
  v_pending boolean := false;
  v_queue text;
BEGIN
  IF v_url IS NULL OR v_key IS NULL THEN
    RETURN NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM public.email_send_state WHERE retry_after_until > now()) THEN
    RETURN NULL;
  END IF;
  FOREACH v_queue IN ARRAY ARRAY['auth_emails', 'transactional_emails'] LOOP
    IF to_regclass('pgmq.q_' || v_queue) IS NOT NULL THEN
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM pgmq.%I)', 'q_' || v_queue) INTO v_pending;
      EXIT WHEN v_pending;
    END IF;
  END LOOP;
  IF NOT v_pending THEN
    RETURN NULL;
  END IF;
  RETURN net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tokeny_vault_secret(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.tokeny_function_url(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.tokeny_kick_auto_sync() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.tokeny_kick_email_queue() FROM PUBLIC, anon, authenticated, service_role;

-- (Re)schedule both jobs; cron.schedule with an existing name replaces the job.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tokeny-auto-sync') THEN
    PERFORM cron.unschedule('tokeny-auto-sync');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-email-queue') THEN
    PERFORM cron.unschedule('process-email-queue');
  END IF;
END $$;

SELECT cron.schedule('tokeny-auto-sync', '17 * * * *', 'SELECT public.tokeny_kick_auto_sync()');
SELECT cron.schedule('process-email-queue', '5 seconds', 'SELECT public.tokeny_kick_email_queue()');
