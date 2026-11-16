-- What a team has paid for. Players never pay: the feed, leaderboard and every personal stat stay
-- free. The Coach view and setting the week's practice need a plan that has not run out.
--
-- Its own table because owners can write every column on teams. Nobody but the service role writes
-- here: no insert, update or delete policy exists.

create table if not exists public.team_plans (
  team_id uuid primary key references public.teams (id) on delete cascade,
  paid_until date not null,
  -- 'trial', 'pilot', or an invoice number.
  note text not null default 'trial',
  updated_at timestamptz not null default now()
);

alter table public.team_plans enable row level security;

create policy team_plans_select on public.team_plans for select
  using (team_id in (select my_team_ids()));

-- Every new team gets thirty days of the Coach view to try it.
create or replace function public.start_team_trial()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.team_plans (team_id, paid_until, note)
  values (new.id, current_date + 30, 'trial')
  on conflict (team_id) do nothing;
  return new;
end $$;

drop trigger if exists teams_start_trial on public.teams;
create trigger teams_start_trial after insert on public.teams
  for each row execute function public.start_team_trial();

create or replace function public.team_plan_active(t uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.team_plans where team_id = t and paid_until >= current_date);
$$;

revoke all on function public.team_plan_active(uuid) from public, anon;
grant execute on function public.team_plan_active(uuid) to authenticated;

drop policy if exists team_focus_insert on public.team_focus;
drop policy if exists team_focus_update on public.team_focus;
create policy team_focus_insert on public.team_focus for insert
  with check (coaches_team(team_id) and team_plan_active(team_id) and set_by = auth.uid());
create policy team_focus_update on public.team_focus for update
  using (coaches_team(team_id))
  with check (coaches_team(team_id) and team_plan_active(team_id) and set_by = auth.uid());

-- Teams that existed before plans: thirty days from when they were made, same as a new one.
insert into public.team_plans (team_id, paid_until, note)
select id, (created_at + interval '30 days')::date, 'trial' from public.teams
on conflict (team_id) do nothing;
