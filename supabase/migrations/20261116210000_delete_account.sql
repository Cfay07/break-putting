-- Delete your own account and everything stored under it. Every table keyed to a user cascades
-- from auth.users. A team goes with its owner, so an owner with players on the team is stopped
-- rather than taking the team down for everyone.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare held text;
begin
  if auth.uid() is null then raise exception 'Not signed in.'; end if;

  select string_agg(t.name, ', ') into held
  from public.teams t
  where t.owner_id = auth.uid()
    and exists (select 1 from public.team_members m where m.team_id = t.id and m.user_id <> auth.uid());
  if held is not null then
    raise exception 'You own % and other players are on it. Ask for it to be handed over first.', held;
  end if;

  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
