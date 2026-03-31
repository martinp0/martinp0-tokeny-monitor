
create table public.activity_rows (
  id uuid primary key default gen_random_uuid(),
  generation_id text not null unique,
  created_at text not null,
  cost_total double precision not null default 0,
  cost_web_search double precision not null default 0,
  cost_cache double precision not null default 0,
  cost_file_processing double precision not null default 0,
  byok_usage_inference double precision not null default 0,
  tokens_prompt integer not null default 0,
  tokens_completion integer not null default 0,
  tokens_reasoning integer not null default 0,
  tokens_cached integer not null default 0,
  model_permaslug text not null default '',
  provider_name text not null default '',
  variant text not null default '',
  cancelled boolean not null default false,
  streamed boolean not null default false,
  "user" text not null default '',
  finish_reason_raw text not null default '',
  finish_reason_normalized text not null default '',
  generation_time_ms double precision not null default 0,
  time_to_first_token_ms double precision not null default 0,
  app_name text not null default '',
  api_key_name text not null default '',
  inserted_at timestamptz not null default now()
);

alter table public.activity_rows enable row level security;

create policy "Allow public read" on public.activity_rows
  for select using (true);

create policy "Allow public insert" on public.activity_rows
  for insert with check (true);

create index idx_activity_created_at on public.activity_rows (created_at);
create index idx_activity_model on public.activity_rows (model_permaslug);
