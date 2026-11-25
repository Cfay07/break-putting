-- Course service answers kept for everyone, so each course is fetched once for the whole app
-- instead of once per phone. The free plan's daily limit ran out in one afternoon of testing.
-- Only the course-lookup function reads or writes it, with the service role; no client policy.
create table if not exists public.course_cache (
  key text primary key,
  body jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table public.course_cache enable row level security;
