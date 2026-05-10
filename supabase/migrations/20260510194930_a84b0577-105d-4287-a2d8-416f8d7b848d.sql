create table if not exists public.subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id    text not null,
  stripe_subscription_id text unique not null,
  status                text not null default 'active',
  current_period_end    timestamptz not null,
  created_at            timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Service role can insert" ON public.subscriptions;
DROP POLICY IF EXISTS "Service role can update" ON public.subscriptions;
DROP POLICY IF EXISTS "Service role can insert subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Service role can update subscription" ON public.subscriptions;

CREATE POLICY "Users can view own subscription"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert subscription"
  ON public.subscriptions FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update subscription"
  ON public.subscriptions FOR UPDATE TO service_role
  USING (true) WITH CHECK (true);