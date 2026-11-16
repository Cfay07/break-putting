-- The team feed. Two tables, both readable by you and your teammates only, written only by you.

-- A practice set as a teammate can see it: what was rolled and how it went, nothing more.
create table if not exists public.team_practice (
  user_id uuid not null references auth.users (id) on delete cascade,
  set_id text not null,
  played_on date not null,
  title text not null,
  kind text not null check (kind in ('test', 'set')),
  made integer not null,
  attempts integer not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, set_id)
);

alter table public.team_practice enable row level security;

create policy team_practice_select on public.team_practice for select
  using (user_id = auth.uid() or user_id in (select my_teammate_ids()));
create policy team_practice_insert on public.team_practice for insert
  with check (user_id = auth.uid());
create policy team_practice_update on public.team_practice for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy team_practice_delete on public.team_practice for delete
  using (user_id = auth.uid());

-- One tap on a post. The post key is "<kind>:<owner id>:<item id>", so the owner can be checked:
-- you can only react to your own posts or a teammate's.
create table if not exists public.team_reactions (
  post text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post, user_id)
);

alter table public.team_reactions enable row level security;

create policy team_reactions_select on public.team_reactions for select
  using (user_id = auth.uid() or user_id in (select my_teammate_ids()));
create policy team_reactions_insert on public.team_reactions for insert
  with check (
    user_id = auth.uid()
    and split_part(post, ':', 2) ~ '^[0-9a-f-]{36}$'
    and (
      split_part(post, ':', 2)::uuid = auth.uid()
      or split_part(post, ':', 2)::uuid in (select my_teammate_ids())
    )
  );
create policy team_reactions_delete on public.team_reactions for delete
  using (user_id = auth.uid());
