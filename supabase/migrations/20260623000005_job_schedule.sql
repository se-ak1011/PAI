-- Booking: give jobs a scheduled date + a job location/address so they can be
-- shown on the dashboard "Jobs of the Day" and (later) a calendar of bookings.
-- Until now job "location" was only used to prompt the AI and was never stored.
-- Idempotent: safe to run more than once.

alter table public.private_jobs
  add column if not exists scheduled_date date,
  add column if not exists location text;

create index if not exists private_jobs_scheduled_idx
  on public.private_jobs (contractor_id, scheduled_date);
