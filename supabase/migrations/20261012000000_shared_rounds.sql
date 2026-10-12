-- A round published behind an unguessable token, so someone with no account can read the whole
-- thing. A snapshot rather than a view onto `rounds`: sharing should not keep following edits
-- made later, and the baseline travels with it so the numbers never drift.
create table if not exists public.shared_rounds (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  round_id uuid not null,
  payload jsonb not null,
  baseline jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, round_id)
);

alter table public.shared_rounds enable row level security;

-- Deliberately no blanket select. The token is the secret, and a readable table would let
-- anyone page through every round anyone has ever shared.
drop policy if exists shared_rounds_owner_select on public.shared_rounds;
create policy shared_rounds_owner_select on public.shared_rounds
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists shared_rounds_owner_insert on public.shared_rounds;
create policy shared_rounds_owner_insert on public.shared_rounds
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists shared_rounds_owner_update on public.shared_rounds;
create policy shared_rounds_owner_update on public.shared_rounds
  for update to authenticated using (auth.uid() = user_id);

drop policy if exists shared_rounds_owner_delete on public.shared_rounds;
create policy shared_rounds_owner_delete on public.shared_rounds
  for delete to authenticated using (auth.uid() = user_id);

-- The only way a signed-out viewer reads one: by presenting the exact token.
create or replace function public.get_shared_round(share_token text)
returns table (payload jsonb, baseline jsonb, shared_by text, shared_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select s.payload,
         s.baseline,
         (select m.display_name
            from public.team_members m
           where m.user_id = s.user_id and m.display_name is not null
           limit 1),
         s.updated_at
    from public.shared_rounds s
   where s.token = share_token;
$$;

revoke all on function public.get_shared_round(text) from public;
grant execute on function public.get_shared_round(text) to anon, authenticated;

-- Re-sharing a round reuses its token, so a link already sent keeps working and picks up any
-- corrections made since.
create or replace function public.share_round(p_round_id uuid, p_payload jsonb, p_baseline jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  t text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  select token into t
    from public.shared_rounds
   where user_id = auth.uid() and round_id = p_round_id;

  if t is null then
    t := translate(encode(extensions.gen_random_bytes(12), 'base64'), '+/=', '-_');
  end if;

  insert into public.shared_rounds (token, user_id, round_id, payload, baseline)
       values (t, auth.uid(), p_round_id, p_payload, p_baseline)
  on conflict (user_id, round_id) do update
          set payload = excluded.payload,
              baseline = excluded.baseline,
              updated_at = now();

  return t;
end;
$$;

revoke all on function public.share_round(uuid, jsonb, jsonb) from public;
grant execute on function public.share_round(uuid, jsonb, jsonb) to authenticated;
