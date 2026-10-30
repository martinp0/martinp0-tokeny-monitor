-- Consolidate public.subscriptions after the duplicate 20260509120000 migrations.
--
-- History: two files shared version 20260509120000:
--   * 20260509120000_subscriptions.sql        – minimal table + "Service role can insert/update"
--     policies WITHOUT a TO clause, i.e. granted to PUBLIC (any authenticated user could
--     insert/update subscriptions = self-grant Pro).
--   * 20260509120000_stripe_subscriptions.sql – richer schema used by stripe-webhook
--     (price_id, current_period_start, cancel_at_period_end, updated_at, UNIQUE(user_id)).
-- Only one row per version can exist in supabase_migrations.schema_migrations, so which one
-- ran is environment-dependent. 20260510194930 later fixed the PUBLIC policies.
-- The insecure duplicate file is removed from the repo in the same PR (its DDL is identical to
-- the first half of 20260510194930, so nothing is lost); this migration converges any database
-- to the schema stripe-webhook / check-subscription expect, idempotently.


CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id     text NOT NULL,
  stripe_subscription_id text UNIQUE,
  status                 text NOT NULL DEFAULT 'inactive',
  current_period_end     timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS price_id text;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS current_period_start timestamptz;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- The minimal variant made these NOT NULL; stripe-webhook may legitimately write without them.
ALTER TABLE public.subscriptions ALTER COLUMN stripe_subscription_id DROP NOT NULL;
ALTER TABLE public.subscriptions ALTER COLUMN current_period_end DROP NOT NULL;

-- stripe-webhook upserts ON CONFLICT (user_id): keep the newest row per user, then enforce it.
DELETE FROM public.subscriptions a
USING public.subscriptions b
WHERE a.user_id = b.user_id
  AND (coalesce(a.current_period_end, a.created_at), a.created_at, a.id)
    < (coalesce(b.current_period_end, b.created_at), b.created_at, b.id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_attribute att ON att.attrelid = i.indrelid AND att.attnum = i.indkey[0]
    WHERE i.indrelid = 'public.subscriptions'::regclass
      AND i.indisunique
      AND i.indnkeyatts = 1
      AND att.attname = 'user_id'
  ) THEN
    ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_user_id_key UNIQUE (user_id);
  END IF;
END $$;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop every policy name used by any earlier migration, then recreate the canonical set.
DROP POLICY IF EXISTS "Users can view own subscription"       ON public.subscriptions;
DROP POLICY IF EXISTS "Service role can insert"               ON public.subscriptions;
DROP POLICY IF EXISTS "Service role can update"               ON public.subscriptions;
DROP POLICY IF EXISTS "Service role can insert subscription"  ON public.subscriptions;
DROP POLICY IF EXISTS "Service role can update subscription"  ON public.subscriptions;
DROP POLICY IF EXISTS "Owner reads own subscription"          ON public.subscriptions;
DROP POLICY IF EXISTS "Service role manages subscriptions"    ON public.subscriptions;

CREATE POLICY "Owner reads own subscription"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages subscriptions"
  ON public.subscriptions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Belt and braces: clients can never write subscriptions, only stripe-webhook (service_role).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.subscriptions FROM anon, authenticated;
REVOKE ALL ON public.subscriptions FROM anon;
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON public.subscriptions (stripe_customer_id);

DROP TRIGGER IF EXISTS subscriptions_updated ON public.subscriptions;
CREATE TRIGGER subscriptions_updated
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

