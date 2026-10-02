-- A deleted round kept its published copy forever: gone from the owner's phone and from
-- `rounds`, still listed on the team feed. The app now sends its tombstones as deletes, which
-- needs a policy to act on. Safe to run more than once.

drop policy if exists "delete own team rounds" on public.team_rounds;

create policy "delete own team rounds"
  on public.team_rounds
  for delete
  to authenticated
  using (auth.uid() = user_id);
