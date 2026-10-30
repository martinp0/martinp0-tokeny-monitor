-- CSV import of Cursor / Grok Bot usage exports (Billing Item ID, Event Time, Product, Usage Type, Usage JSON, ...).
-- * provider_source gains 'cursor' and 'grok-bot'.
-- * tokens_cache_write keeps cache-write tokens separate from cached reads (tokens_cached) and fresh input.
-- * billing_type records whether a call was covered by the plan ('included'), billed over the plan
--   ('on_demand') or paid from prepaid credits ('credits'). NULL for providers without this concept.
-- Rows are still written by the signed-in user under the existing RLS policies (user_id = auth.uid());
-- deduplication stays on the existing unique key (user_id, generation_id) = (user, Billing Item ID).

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
    WHERE con.conrelid = 'public.activity_rows'::regclass
      AND con.contype = 'c'
      AND att.attname = 'provider_source'
  LOOP
    EXECUTE format('ALTER TABLE public.activity_rows DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.activity_rows
  ADD CONSTRAINT activity_rows_provider_source_check
  CHECK (provider_source IN ('openrouter', 'anthropic', 'openai', 'gemini', 'mistral', 'groq', 'xai', 'cursor', 'grok-bot'));

ALTER TABLE public.activity_rows
  ADD COLUMN IF NOT EXISTS tokens_cache_write bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_type text
    CHECK (billing_type IS NULL OR billing_type IN ('included', 'on_demand', 'credits'));
