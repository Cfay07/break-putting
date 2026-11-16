-- What an invite link shows before you have an account: the team's name and colour, nothing else.
-- The code is the secret, so knowing it is enough to see who you are joining.

create or replace function public.team_by_code(code text)
returns table (name text, accent text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select t.name, t.theme ->> 'accent'
  from public.teams t
  where upper(t.join_code) = upper(btrim(code));
$$;

revoke all on function public.team_by_code(text) from public;
grant execute on function public.team_by_code(text) to anon, authenticated;
