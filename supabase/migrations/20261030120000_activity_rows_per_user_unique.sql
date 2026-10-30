-- P0 data integrity: generation_id must be unique per user, not globally.
--
-- Before: activity_rows.generation_id had a global UNIQUE constraint and every sync/CSV import
-- upserted ON CONFLICT (generation_id). Synthetic ids (e.g. OpenRouter "<date>_<model>_<endpoint>"
-- or "anthropic::<bucket>::<model>::...") are identical for different users, so one user's sync
-- silently overwrote another user's row (including user_id) — cross-tenant data corruption.
--
-- After: UNIQUE (user_id, generation_id); all writers use onConflict 'user_id,generation_id'.
--
-- Note: rows already overwritten in the past cannot be reconstructed. Affected users must
-- re-sync / re-import (see PR deploy checklist). Legacy rows with user_id IS NULL are left as is
-- (they are invisible through RLS anyway).


-- 1. Defensive dedupe on the new key (should be a no-op under the old global constraint,
--    but keeps the migration safe if the constraint was ever dropped manually).
DELETE FROM public.activity_rows a
USING public.activity_rows b
WHERE a.user_id IS NOT NULL
  AND a.user_id = b.user_id
  AND a.generation_id = b.generation_id
  AND (a.inserted_at, a.id) < (b.inserted_at, b.id);

-- 2. Drop every UNIQUE constraint / unique index that covers generation_id alone
--    (default name is activity_rows_generation_id_key, but don't rely on it).
DO $$
DECLARE
  gen_attnum smallint;
  r record;
BEGIN
  SELECT attnum INTO gen_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.activity_rows'::regclass AND attname = 'generation_id';

  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.activity_rows'::regclass
      AND contype = 'u'
      AND conkey = ARRAY[gen_attnum]
  LOOP
    EXECUTE format('ALTER TABLE public.activity_rows DROP CONSTRAINT %I', r.conname);
  END LOOP;

  FOR r IN
    SELECT c.relname AS indexname
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    WHERE i.indrelid = 'public.activity_rows'::regclass
      AND i.indisunique
      AND NOT i.indisprimary
      AND i.indkey::smallint[] = ARRAY[gen_attnum]
      AND NOT EXISTS (SELECT 1 FROM pg_constraint pc WHERE pc.conindid = i.indexrelid)
  LOOP
    EXECUTE format('DROP INDEX public.%I', r.indexname);
  END LOOP;
END $$;

-- 3. New per-user uniqueness (also serves as the ON CONFLICT arbiter for upserts).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.activity_rows'::regclass
      AND conname = 'activity_rows_user_generation_key'
  ) THEN
    ALTER TABLE public.activity_rows
      ADD CONSTRAINT activity_rows_user_generation_key UNIQUE (user_id, generation_id);
  END IF;
END $$;

-- 4. Index for the dashboard's per-user, time-ordered reads and the aggregate RPC.
CREATE INDEX IF NOT EXISTS idx_activity_user_created
  ON public.activity_rows (user_id, created_at DESC);

