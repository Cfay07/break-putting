-- Courses every player can find: one typed in by hand or loaded from the course service on any
-- phone is here for the whole app. Anyone signed in reads and adds; only whoever added a course
-- can change it, so one bad par cannot be overwritten by a stranger. Nothing is deleted.
create table if not exists public.shared_courses (
  id text primary key,
  name text not null check (length(name) between 1 and 120),
  place text check (place is null or length(place) <= 120),
  tees jsonb not null check (jsonb_typeof(tees) = 'array'),
  source text not null default 'typed' check (source in ('typed', 'service', 'scorecard')),
  added_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.shared_courses enable row level security;

create policy "signed in players read shared courses" on public.shared_courses
  for select to authenticated using (true);
create policy "signed in players add shared courses" on public.shared_courses
  for insert to authenticated with check (added_by = (select auth.uid()));
create policy "players change courses they added" on public.shared_courses
  for update to authenticated using (added_by = (select auth.uid())) with check (added_by = (select auth.uid()));
