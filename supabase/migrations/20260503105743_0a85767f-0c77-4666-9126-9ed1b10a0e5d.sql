
-- 1. Add user_id to activity_rows (nullable for now, existing data has no owner)
ALTER TABLE public.activity_rows ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Replace the overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated read only" ON public.activity_rows;
CREATE POLICY "Users can read own activity rows"
  ON public.activity_rows FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 3. Allow service_role to do everything (for edge function writes)
DROP POLICY IF EXISTS "Service role insert" ON public.activity_rows;
CREATE POLICY "Service role full access"
  ON public.activity_rows FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 4. Revoke EXECUTE on email queue functions from anon and authenticated
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated;

-- 5. Fix search_path on email queue functions
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
