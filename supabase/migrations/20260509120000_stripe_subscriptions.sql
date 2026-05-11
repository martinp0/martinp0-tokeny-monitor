-- Stripe Pro tier: subscriptions table + RLS
-- Stores Stripe subscription data per user. Written only by stripe-webhook (service role).

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id   TEXT NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  price_id             TEXT,
  status               TEXT NOT NULL DEFAULT 'inactive'
                         CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'inactive')),
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only read their own subscription
DROP POLICY IF EXISTS "Owner reads own subscription" ON public.subscriptions;
CREATE POLICY "Owner reads own subscription"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- All writes go through stripe-webhook edge function (service_role)
DROP POLICY IF EXISTS "Service role manages subscriptions" ON public.subscriptions;
CREATE POLICY "Service role manages subscriptions"
  ON public.subscriptions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Revoke direct client write access — only service_role via Edge Function
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM authenticated;

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
  ON public.subscriptions (user_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer
  ON public.subscriptions (stripe_customer_id);

-- Auto-update updated_at
DROP TRIGGER IF EXISTS subscriptions_updated ON public.subscriptions;
CREATE TRIGGER subscriptions_updated
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
