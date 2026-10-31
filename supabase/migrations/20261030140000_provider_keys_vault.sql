-- Provider API keys encrypted at rest in Supabase Vault.
--
-- Before: public.provider_credentials.api_key held the plaintext key (hidden from the browser by
-- column grants, but readable by anyone with database access, in backups and in logs of queries).
-- After:  the key lives only in vault.secrets (authenticated encryption, root key outside the
--         database); the table keeps a reference (api_key_secret_id) and a masked preview of the
--         last 4 characters. Keys are written/read only through SECURITY DEFINER functions that
--         only service_role (edge functions) may execute. The browser never receives a key.
--
-- Deploy together with the edge functions that call these RPCs (save-provider-credential,
-- sync-openrouter, sync-anthropic, sync-openai, auto-sync, delete-account).

CREATE EXTENSION IF NOT EXISTS supabase_vault CASCADE;

-- ------------------------------------------------------------------
-- 1. Reference column
-- ------------------------------------------------------------------
ALTER TABLE public.provider_credentials
  ADD COLUMN IF NOT EXISTS api_key_secret_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS provider_credentials_api_key_secret_id_key
  ON public.provider_credentials (api_key_secret_id)
  WHERE api_key_secret_id IS NOT NULL;

COMMENT ON COLUMN public.provider_credentials.api_key_secret_id IS
  'vault.secrets.id of the encrypted provider API key. Read only via public.get_provider_credential_key (service_role).';
COMMENT ON COLUMN public.provider_credentials.key_preview IS
  'Masked key for the UI: bullets + last 4 characters. Never the full key.';

-- ------------------------------------------------------------------
-- 2. Helpers
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mask_provider_key(p_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_key IS NULL OR length(btrim(p_key)) = 0 THEN ''
    WHEN length(btrim(p_key)) < 12 THEN '••••'
    ELSE '••••' || right(btrim(p_key), 4)
  END;
$$;

-- Store (create or rotate) the Vault secret for one credential row. Internal: callers are the
-- SECURITY DEFINER functions below and the one-off backfill.
CREATE OR REPLACE FUNCTION public._store_provider_key(p_credential_id uuid, p_api_key text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret_id uuid;
  v_name text := 'tokeny_provider_credential_' || p_credential_id::text;
BEGIN
  SELECT c.api_key_secret_id INTO v_secret_id
  FROM public.provider_credentials c
  WHERE c.id = p_credential_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'provider credential % not found', p_credential_id USING ERRCODE = 'P0002';
  END IF;

  IF v_secret_id IS NOT NULL AND EXISTS (SELECT 1 FROM vault.secrets s WHERE s.id = v_secret_id) THEN
    PERFORM vault.update_secret(v_secret_id, p_api_key);
  ELSE
    -- A stale secret with the same name (e.g. a half-finished earlier attempt) would violate the
    -- unique name; remove it first.
    DELETE FROM vault.secrets s WHERE s.name = v_name;
    v_secret_id := vault.create_secret(p_api_key, v_name, 'Tokeny provider API key');
  END IF;

  UPDATE public.provider_credentials c
  SET api_key_secret_id = v_secret_id,
      key_preview = public.mask_provider_key(p_api_key)
  WHERE c.id = p_credential_id;

  RETURN v_secret_id;
END;
$$;

-- ------------------------------------------------------------------
-- 3. Backfill existing plaintext keys into Vault, then drop the column
-- ------------------------------------------------------------------
DO $$
DECLARE
  r record;
  has_plaintext boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'provider_credentials' AND column_name = 'api_key'
  ) INTO has_plaintext;

  IF has_plaintext THEN
    FOR r IN EXECUTE
      'SELECT id, api_key FROM public.provider_credentials
       WHERE api_key IS NOT NULL AND length(btrim(api_key)) > 0 AND api_key_secret_id IS NULL'
    LOOP
      PERFORM public._store_provider_key(r.id, btrim(r.api_key));
    END LOOP;

    -- Every non-empty plaintext key must now have a Vault secret; abort (rolling back the
    -- migration) rather than drop a key we failed to copy.
    EXECUTE 'SELECT count(*) = 0 FROM public.provider_credentials
             WHERE api_key IS NOT NULL AND length(btrim(api_key)) > 0 AND api_key_secret_id IS NULL'
      INTO has_plaintext;
    IF NOT has_plaintext THEN
      RAISE EXCEPTION 'provider key backfill incomplete; not dropping api_key';
    END IF;

    ALTER TABLE public.provider_credentials DROP COLUMN api_key;
  END IF;
END $$;

-- ------------------------------------------------------------------
-- 4. Service-role API
-- ------------------------------------------------------------------

-- Create or update (user, provider, label) and store its key in Vault, atomically.
CREATE OR REPLACE FUNCTION public.save_provider_credential(
  p_user_id uuid,
  p_provider text,
  p_label text,
  p_api_key text,
  p_organization_id text DEFAULT NULL
)
RETURNS TABLE (
  id uuid, provider text, label text, key_preview text, enabled boolean,
  organization_id text, last_synced_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_id uuid;
  v_key text := btrim(coalesce(p_api_key, ''));
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user id is required' USING ERRCODE = '22023';
  END IF;
  IF length(v_key) < 8 OR length(v_key) > 512 THEN
    RAISE EXCEPTION 'invalid api key length' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.provider_credentials AS c
    (user_id, provider, label, key_preview, organization_id, enabled, last_sync_status, last_sync_error)
  VALUES
    (p_user_id, p_provider, coalesce(nullif(btrim(p_label), ''), 'Default'),
     public.mask_provider_key(v_key), p_organization_id, true, NULL, NULL)
  ON CONFLICT (user_id, provider, label) DO UPDATE
    SET organization_id = EXCLUDED.organization_id,
        enabled = true,
        last_sync_status = NULL,
        last_sync_error = NULL
  RETURNING c.id INTO v_id;

  PERFORM public._store_provider_key(v_id, v_key);

  RETURN QUERY
  SELECT c.id, c.provider, c.label, c.key_preview, c.enabled, c.organization_id, c.last_synced_at
  FROM public.provider_credentials c
  WHERE c.id = v_id;
END;
$$;

-- Decrypted key for one credential (NULL if none stored). Edge functions only.
CREATE OR REPLACE FUNCTION public.get_provider_credential_key(p_credential_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT d.decrypted_secret
  FROM public.provider_credentials c
  JOIN vault.decrypted_secrets d ON d.id = c.api_key_secret_id
  WHERE c.id = p_credential_id;
$$;

-- Delete one credential (p_credential_id) or all of a user's credentials (NULL), with their
-- Vault secrets (via the trigger below). Returns the number of credentials deleted.
CREATE OR REPLACE FUNCTION public.delete_provider_credentials(p_user_id uuid, p_credential_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  n integer;
BEGIN
  DELETE FROM public.provider_credentials c
  WHERE c.user_id = p_user_id
    AND (p_credential_id IS NULL OR c.id = p_credential_id);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- Same columns as before (api_key is now decrypted from Vault), so auto-sync needs no change.
CREATE OR REPLACE FUNCTION public.auto_sync_due_credentials(p_due_before timestamptz, p_limit int DEFAULT 50)
RETURNS TABLE (id uuid, user_id uuid, provider text, api_key text, enabled boolean, last_synced_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.id, c.user_id, c.provider, d.decrypted_secret, c.enabled, c.last_synced_at
  FROM public.provider_credentials c
  JOIN vault.decrypted_secrets d ON d.id = c.api_key_secret_id
  WHERE c.enabled
    AND c.provider IN ('openrouter', 'anthropic', 'openai')
    AND (c.last_sync_attempt_at IS NULL OR c.last_sync_attempt_at < p_due_before)
    AND public.is_pro(c.user_id)
  ORDER BY c.last_sync_attempt_at ASC NULLS FIRST
  LIMIT greatest(1, least(coalesce(p_limit, 50), 500));
$$;

-- ------------------------------------------------------------------
-- 5. Remove the Vault secret whenever a credential row goes away
--    (UI delete via RLS, delete_provider_credentials, ON DELETE CASCADE from auth.users).
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.provider_credentials_drop_secret()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.api_key_secret_id IS NOT NULL THEN
    DELETE FROM vault.secrets s WHERE s.id = OLD.api_key_secret_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS provider_credentials_drop_secret ON public.provider_credentials;
CREATE TRIGGER provider_credentials_drop_secret
  AFTER DELETE ON public.provider_credentials
  FOR EACH ROW EXECUTE FUNCTION public.provider_credentials_drop_secret();

-- ------------------------------------------------------------------
-- 6. Privileges
-- ------------------------------------------------------------------
-- Functions: service_role only (Supabase grants EXECUTE to anon/authenticated by default).
REVOKE ALL ON FUNCTION public._store_provider_key(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.save_provider_credential(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_provider_credential_key(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_provider_credentials(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auto_sync_due_credentials(timestamptz, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.provider_credentials_drop_secret() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_provider_credential(uuid, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_provider_credential_key(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_provider_credentials(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_sync_due_credentials(timestamptz, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.mask_provider_key(text) TO service_role;

-- Table: the browser may read metadata, rename/enable/disable and delete its own rows (RLS).
-- It can no longer insert rows (keys are saved only through save-provider-credential) and can
-- never touch api_key_secret_id or key_preview.
REVOKE ALL ON public.provider_credentials FROM anon;
REVOKE ALL ON public.provider_credentials FROM authenticated;
GRANT SELECT (
  id, user_id, provider, label, key_preview, enabled, organization_id,
  last_synced_at, last_sync_status, last_sync_error, rows_imported,
  created_at, updated_at, last_sync_attempt_at
) ON public.provider_credentials TO authenticated;
GRANT UPDATE (label, enabled, organization_id, updated_at) ON public.provider_credentials TO authenticated;
GRANT DELETE ON public.provider_credentials TO authenticated;
DROP POLICY IF EXISTS "Owner writes own credentials" ON public.provider_credentials;
