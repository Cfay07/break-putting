-- BREAK! cloud sync.
-- Paste this whole file into the Supabase SQL editor and run it once.
--
-- One row per round and per putter, each stamped with when it changed, so two devices
-- can merge by taking whichever copy is newer. Deletes are tombstones rather than real
-- deletes, otherwise a phone that was offline would resurrect a round you removed.

create table if not exists public.rounds (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  payload     jsonb not null,
  deleted     boolean not null default false,
  updated_at  timestamptz not null default now()
);

create table if not exists public.putters (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  payload     jsonb not null,
  deleted     boolean not null default false,
  updated_at  timestamptz not null default now()
);

-- Baseline and saved courses travel as one blob; they are small and rarely conflict.
create table if not exists public.settings (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  payload     jsonb not null,
  updated_at  timestamptz not null default now()
);

create index if not exists rounds_user_updated on public.rounds (user_id, updated_at);
create index if not exists putters_user_updated on public.putters (user_id, updated_at);

alter table public.rounds enable row level security;
alter table public.putters enable row level security;
alter table public.settings enable row level security;

-- Every row is readable and writable only by the account that owns it. A teammate
-- signing in gets their own rows and cannot see anyone else's.
do $$
declare t text;
begin
  foreach t in array array['rounds', 'putters', 'settings'] loop
    execute format('drop policy if exists own_rows_select on public.%I', t);
    execute format('drop policy if exists own_rows_insert on public.%I', t);
    execute format('drop policy if exists own_rows_update on public.%I', t);
    execute format('create policy own_rows_select on public.%I for select using (auth.uid() = user_id)', t);
    execute format('create policy own_rows_insert on public.%I for insert with check (auth.uid() = user_id)', t);
    execute format('create policy own_rows_update on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;
