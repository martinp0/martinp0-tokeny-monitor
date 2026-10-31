-- Assertions for 20261030140000_provider_keys_vault.sql. Run by run-vault-test.sh after the
-- migration, on a database seeded (before the migration) with users u1/u2 and one plaintext key.
\set ON_ERROR_STOP on
SET client_min_messages = warning;

DO $$
DECLARE
  u1 uuid := '00000000-0000-0000-0000-000000000001';
  u2 uuid := '00000000-0000-0000-0000-000000000002';
  c_old uuid; c_new uuid; s1 uuid; s2 uuid; k text; n int; r record;
BEGIN
  -- 1. Backfill: plaintext column is gone, the old key is in Vault and masked.
  ASSERT NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = 'provider_credentials' AND column_name = 'api_key'),
         'api_key column must be dropped';
  SELECT id, api_key_secret_id INTO c_old, s1 FROM public.provider_credentials WHERE user_id = u1 AND provider = 'openrouter';
  ASSERT s1 IS NOT NULL, 'backfilled row has a secret id';
  ASSERT public.get_provider_credential_key(c_old) = 'sk-or-v1-plaintext-legacy-key-9876', 'backfilled key decrypts';
  ASSERT (SELECT key_preview FROM public.provider_credentials WHERE id = c_old) = '••••9876', 'preview is last 4';
  ASSERT (SELECT secret <> 'sk-or-v1-plaintext-legacy-key-9876' FROM vault.secrets WHERE id = s1), 'stored ciphertext, not plaintext';

  -- 2. Save a new credential, then rotate it: same row, same secret, new value.
  SELECT id INTO c_new FROM public.save_provider_credential(u1, 'anthropic', 'Work', 'sk-ant-admin01-first-key-1111', 'org_1');
  SELECT api_key_secret_id INTO s2 FROM public.provider_credentials WHERE id = c_new;
  ASSERT public.get_provider_credential_key(c_new) = 'sk-ant-admin01-first-key-1111', 'new key decrypts';
  PERFORM public.save_provider_credential(u1, 'anthropic', 'Work', '  sk-ant-admin01-rotated-key-2222  ', NULL);
  ASSERT (SELECT count(*) FROM public.provider_credentials WHERE user_id = u1 AND provider = 'anthropic') = 1, 'upsert, not duplicate';
  ASSERT (SELECT api_key_secret_id FROM public.provider_credentials WHERE id = c_new) = s2, 'rotation reuses the secret';
  ASSERT public.get_provider_credential_key(c_new) = 'sk-ant-admin01-rotated-key-2222', 'rotated key decrypts (trimmed)';
  SELECT * INTO r FROM public.provider_credentials WHERE id = c_new;
  ASSERT r.key_preview = '••••2222' AND r.organization_id IS NULL AND r.enabled, 'metadata updated on rotation';

  -- 3. Validation.
  BEGIN
    PERFORM public.save_provider_credential(u1, 'openai', 'x', 'short', NULL);
    ASSERT false, 'short key must be rejected';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  -- 4. Auto-sync sees decrypted keys for Pro users only.
  ASSERT NOT EXISTS (SELECT 1 FROM public.auto_sync_due_credentials(now(), 50)), 'free user not auto-synced';
  INSERT INTO public.subscriptions (user_id, stripe_customer_id, stripe_subscription_id, status, current_period_end)
  VALUES (u1, 'cus_test', 'sub_test', 'active', now() + interval '10 days');
  ASSERT (SELECT count(*) FROM public.auto_sync_due_credentials(now(), 50) a
          WHERE a.api_key IN ('sk-or-v1-plaintext-legacy-key-9876', 'sk-ant-admin01-rotated-key-2222')) = 2,
         'auto_sync_due_credentials returns decrypted keys';

  -- 5. delete_provider_credentials removes rows and their secrets; other users untouched.
  PERFORM public.save_provider_credential(u2, 'openai', 'Default', 'sk-admin-user-two-key-3333', NULL);
  n := public.delete_provider_credentials(u1, c_new);
  ASSERT n = 1 AND NOT EXISTS (SELECT 1 FROM vault.secrets WHERE id = s2), 'single delete drops secret';
  ASSERT (SELECT count(*) FROM public.provider_credentials WHERE user_id = u2) = 1, 'other user untouched';
END $$;

-- 6. Browser roles: no function access, no secret id, no inserts; RLS-scoped delete drops the secret.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE ok boolean;
BEGIN
  BEGIN PERFORM public.get_provider_credential_key(gen_random_uuid()); ok := false;
  EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  ASSERT ok, 'authenticated cannot call get_provider_credential_key';
  BEGIN PERFORM public.save_provider_credential(auth.uid(), 'openai', 'x', 'sk-admin-xxxxxxxxxxxx', NULL); ok := false;
  EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  ASSERT ok, 'authenticated cannot call save_provider_credential';
  BEGIN PERFORM public.delete_provider_credentials(auth.uid(), NULL); ok := false;
  EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  ASSERT ok, 'authenticated cannot call delete_provider_credentials';
  BEGIN PERFORM api_key_secret_id FROM public.provider_credentials; ok := false;
  EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  ASSERT ok, 'authenticated cannot read api_key_secret_id';
  BEGIN PERFORM 1 FROM vault.decrypted_secrets; ok := false;
  EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  ASSERT ok, 'authenticated cannot read vault';
  BEGIN INSERT INTO public.provider_credentials (user_id, provider, key_preview) VALUES (auth.uid(), 'openai', 'x'); ok := false;
  EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  ASSERT ok, 'authenticated cannot insert credentials directly';
  ASSERT (SELECT count(*) FROM public.provider_credentials) = 1, 'RLS: only own rows visible';
  ASSERT (SELECT key_preview FROM public.provider_credentials) = '••••9876', 'own preview readable';
  DELETE FROM public.provider_credentials;  -- the UI's "remove" button
END $$;
RESET ROLE;
DO $$
BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM public.provider_credentials WHERE user_id = '00000000-0000-0000-0000-000000000001'),
         'UI delete removed the row';
  ASSERT NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name LIKE 'tokeny_provider_credential_%'
                     AND id NOT IN (SELECT api_key_secret_id FROM public.provider_credentials WHERE api_key_secret_id IS NOT NULL)),
         'no orphaned secrets after UI delete';
END $$;

SET ROLE anon;
DO $$
DECLARE ok boolean;
BEGIN
  BEGIN PERFORM 1 FROM public.provider_credentials; ok := false;
  EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  ASSERT ok, 'anon has no table access';
END $$;
RESET ROLE;

-- 7. Deleting the auth user (delete-account) cascades and drops the secret.
DO $$
BEGIN
  DELETE FROM auth.users WHERE id = '00000000-0000-0000-0000-000000000002';
  ASSERT NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name LIKE 'tokeny_provider_credential_%'), 'cascade drops secrets';
END $$;

\echo 'provider_keys_vault: all assertions passed'
