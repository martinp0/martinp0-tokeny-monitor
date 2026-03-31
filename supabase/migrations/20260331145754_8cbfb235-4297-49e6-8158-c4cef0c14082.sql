-- Remove the permissive public insert policy
DROP POLICY IF EXISTS "Allow public insert" ON public.activity_rows;

-- Create a restrictive insert policy: only service_role can insert
-- (Edge functions use service_role key, so sync will still work)
CREATE POLICY "Service role insert only"
  ON public.activity_rows
  FOR INSERT
  TO service_role
  WITH CHECK (true);