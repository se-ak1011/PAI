-- Portfolio Projects with completed-job photo references.
-- Job-originated projects reuse private job photo storage paths rather than
-- duplicating objects, preserving a link back to the genuine completed PAI job.

create table if not exists public.portfolio_projects (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'photo_library' check (source in ('completed_job', 'photo_library')),
  source_job_id uuid references public.private_jobs(id) on delete set null,
  title text not null,
  trade text,
  location text,
  description text,
  photos jsonb not null default '[]'::jsonb,
  cover_photo_path text,
  verified boolean not null default false,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint completed_job_projects_are_verified check (source <> 'completed_job' or verified = true),
  constraint manual_projects_are_not_verified check (source <> 'photo_library' or verified = false)
);

alter table public.portfolio_projects enable row level security;

drop policy if exists "Portfolio projects: owner can read" on public.portfolio_projects;
create policy "Portfolio projects: owner can read"
  on public.portfolio_projects for select
  using (auth.uid() = contractor_id);

drop policy if exists "Portfolio projects: owner can insert" on public.portfolio_projects;
create policy "Portfolio projects: owner can insert"
  on public.portfolio_projects for insert
  with check (auth.uid() = contractor_id);

drop policy if exists "Portfolio projects: owner can update" on public.portfolio_projects;
create policy "Portfolio projects: owner can update"
  on public.portfolio_projects for update
  using (auth.uid() = contractor_id)
  with check (auth.uid() = contractor_id);

drop policy if exists "Portfolio projects: owner can delete" on public.portfolio_projects;
create policy "Portfolio projects: owner can delete"
  on public.portfolio_projects for delete
  using (auth.uid() = contractor_id);
