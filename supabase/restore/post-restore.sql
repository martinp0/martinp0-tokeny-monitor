-- Run once on the NEW Supabase project right after restoring the Lovable Cloud export
-- (scripts/restore-lovable-export.sh does this for you).
--
-- The restore only carries the `public` and `supabase_migrations` schemas plus `auth` data.
-- Everything below lives in other schemas, was created by migrations that the restored history
-- marks as already applied, and therefore would never be recreated by `supabase db push`.
-- Idempotent.

-- 1. New sign-ups get a profile (trigger on auth.users, from 20260331151112).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Email queues (pgmq, from 20260331152212_email_infra). Messages still queued on Lovable are
--    not carried over.
DO $$
DECLARE q text;
BEGIN
  FOREACH q IN ARRAY ARRAY['auth_emails', 'transactional_emails', 'auth_emails_dlq', 'transactional_emails_dlq'] LOOP
    BEGIN PERFORM pgmq.create(q); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

-- 3. og-images bucket and its policies (from 20260509065744 + 20260509065808: public bucket,
--    no blanket SELECT policy, users write only under <their user id>/).
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN
    RAISE NOTICE 'storage schema not present, skipping bucket setup';
    RETURN;
  END IF;
  INSERT INTO storage.buckets (id, name, public) VALUES ('og-images', 'og-images', true)
  ON CONFLICT (id) DO UPDATE SET public = true;

  DROP POLICY IF EXISTS "OG images are publicly readable" ON storage.objects;
  DROP POLICY IF EXISTS "Users can upload their own OG images" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update their own OG images" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their own OG images" ON storage.objects;
  CREATE POLICY "Users can upload their own OG images" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'og-images' AND auth.uid()::text = (storage.foldername(name))[1]);
  CREATE POLICY "Users can update their own OG images" ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'og-images' AND auth.uid()::text = (storage.foldername(name))[1]);
  CREATE POLICY "Users can delete their own OG images" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'og-images' AND auth.uid()::text = (storage.foldername(name))[1]);
END $$;

-- 4. Vault secrets and cron jobs are NOT carried (Vault is encrypted with the old project's key,
--    which Lovable does not hand out). Pending migrations recreate the jobs; set the secrets as
--    described in docs/migrate-off-lovable.md, step 6.
