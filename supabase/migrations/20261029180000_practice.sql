-- Practice sets. Same shape and the same owner-only rules as rounds, kept in their own table
-- on purpose: a set rolled on a flat mat must never be read by anything that reads rounds.

create table if not exists public.practice (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  payload     jsonb not null,
  deleted     boolean not null default false,
  updated_at  timestamptz not null default now()
);

create index if not exists practice_user_updated on public.practice (user_id, updated_at);

alter table public.practice enable row level security;

drop policy if exists own_rows_select on public.practice;
drop policy if exists own_rows_insert on public.practice;
drop policy if exists own_rows_update on public.practice;
create policy own_rows_select on public.practice for select using (auth.uid() = user_id);
create policy own_rows_insert on public.practice for insert with check (auth.uid() = user_id);
create policy own_rows_update on public.practice for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update on public.practice to authenticated;
revoke all on public.practice from anon;
