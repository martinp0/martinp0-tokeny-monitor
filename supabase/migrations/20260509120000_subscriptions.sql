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

create policy "Users can view own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create policy "Service role can insert"
  on public.subscriptions for insert
  with check (true);

create policy "Service role can update"
  on public.subscriptions for update
  using (true);
