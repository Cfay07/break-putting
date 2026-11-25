-- Every course in the states BREAK! players play, so search always finds the course without the
-- rate-limited course service. Names, towns and locations only: tees and ratings are looked up
-- when a player first opens a course, then shared. Loaded from OpenGolfAPI, open data under
-- ODbL 1.0 (OpenStreetMap contributors); the app credits it in Settings. Read only to clients.
create table if not exists public.course_directory (
  id text primary key,
  name text not null,
  city text,
  state text not null,
  lat double precision,
  lng double precision,
  par int,
  holes int,
  kind text,
  updated_at timestamptz not null default now()
);
alter table public.course_directory enable row level security;
create policy "anyone reads the course directory" on public.course_directory
  for select to anon, authenticated using (true);
create index if not exists course_directory_name on public.course_directory using gin (to_tsvector('simple', name));
