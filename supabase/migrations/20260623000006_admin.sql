-- Admin access control. Admin status lives in its own table that NO client can
-- write to (only the service role / SQL editor) — so nobody can self-elevate.
-- All privileged moderation (resolving disputes, removing/restoring reviews) runs
-- server-side in the `admin` Edge Function using the service role; the per-user
-- RLS on disputes/reviews below stays locked exactly as it was.
-- Idempotent: safe to run more than once.
--
-- To make someone an admin, run (in the SQL editor):
--   insert into public.admins (user_id) values ('<their auth user id>');

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- A signed-in user may check ONLY whether they themselves are an admin.
-- There is intentionally NO insert/update/delete policy: clients can never
-- grant or revoke admin (the service role bypasses RLS for seeding).
drop policy if exists admins_select_self on public.admins;
create policy admins_select_self
  on public.admins for select
  using (user_id = auth.uid());

-- Convenience helper (security definer) for any future admin-gated RLS.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

grant execute on function public.is_admin() to authenticated;
