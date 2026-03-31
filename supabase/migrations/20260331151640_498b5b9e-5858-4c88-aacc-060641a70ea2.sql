-- Revoke anon access to activity_rows
REVOKE SELECT ON public.activity_rows FROM anon;

-- Drop existing SELECT policy and recreate
DROP POLICY IF EXISTS "Authenticated read" ON public.activity_rows;
DROP POLICY IF EXISTS "Allow public read" ON public.activity_rows;

CREATE POLICY "Authenticated read only"
  ON public.activity_rows FOR SELECT TO authenticated
  USING (true);