create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  original_url text not null,
  normalized_url text not null unique,
  company_name text not null,
  job_title text not null default 'Job Opportunity',
  favicon_url text,
  created_at timestamptz not null default now()
);
create index if not exists jobs_company_idx on public.jobs (company_name);
create index if not exists jobs_created_idx on public.jobs (created_at desc);
-- RLS on, no policies: the public anon key can do nothing.
-- All access goes through server routes using the service role key.
alter table public.jobs enable row level security;

-- v2: who shared it + leaderboard (existing databases: run only this block)
alter table public.jobs add column if not exists added_by text not null default 'Anonymous';
create table if not exists public.contributors (
  name_key text primary key,
  name text not null,
  link_count int not null default 0
);
alter table public.contributors enable row level security;
create or replace function public.bump_contributor(p_name text) returns void language sql as $$
  insert into public.contributors (name_key, name, link_count) values (lower(p_name), p_name, 1)
  on conflict (name_key) do update set link_count = public.contributors.link_count + 1;
$$;
