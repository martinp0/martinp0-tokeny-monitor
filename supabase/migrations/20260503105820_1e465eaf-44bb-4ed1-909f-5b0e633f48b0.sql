
-- Allow authenticated users to insert their own activity rows
CREATE POLICY "Users can insert own activity rows"
  ON public.activity_rows FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to update their own activity rows
CREATE POLICY "Users can update own activity rows"
  ON public.activity_rows FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to delete their own activity rows
CREATE POLICY "Users can delete own activity rows"
  ON public.activity_rows FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
