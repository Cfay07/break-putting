-- The coach view. A coach is a team member who does not play: the owner names them. Owners and
-- coaches pick the week's practice, which sits at the top of every player's Practice.

alter table public.team_members drop constraint team_members_role_check;
alter table public.team_members
  add constraint team_members_role_check check (role in ('owner', 'member', 'coach'));

create or replace function public.coaches_team(t uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.team_members
    where team_id = t and user_id = auth.uid() and role in ('owner', 'coach')
  );
$$;

-- Role is not a column players can write, so this is the only way it changes.
create or replace function public.set_member_role(t uuid, member uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new_role not in ('member', 'coach') then raise exception 'Not a role.'; end if;
  if not exists (select 1 from public.teams where id = t and owner_id = auth.uid()) then
    raise exception 'Only the team owner can do that.';
  end if;
  if exists (select 1 from public.teams where id = t and owner_id = member) then
    raise exception 'The owner stays the owner.';
  end if;
  update public.team_members set role = new_role where team_id = t and user_id = member;
end $$;

revoke all on function public.set_member_role(uuid, uuid, text) from public, anon;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;
revoke all on function public.coaches_team(uuid) from public, anon;
grant execute on function public.coaches_team(uuid) to authenticated;

-- One pick per team. Setting a new one replaces the old.
create table if not exists public.team_focus (
  team_id uuid primary key references public.teams (id) on delete cascade,
  session text not null,
  set_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  set_at timestamptz not null default now()
);

alter table public.team_focus enable row level security;

create policy team_focus_select on public.team_focus for select
  using (team_id in (select my_team_ids()));
create policy team_focus_insert on public.team_focus for insert
  with check (coaches_team(team_id) and set_by = auth.uid());
create policy team_focus_update on public.team_focus for update
  using (coaches_team(team_id)) with check (coaches_team(team_id) and set_by = auth.uid());
create policy team_focus_delete on public.team_focus for delete
  using (coaches_team(team_id));

-- Which session a set was rolled in, so the coach sees who did the week's practice.
alter table public.team_practice add column if not exists session text;
