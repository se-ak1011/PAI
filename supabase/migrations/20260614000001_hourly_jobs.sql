-- ============================================================================
-- PAI-Trades — Hourly jobs support
-- Adds job_type, hourly_rate, estimated_hours, actual_hours to private_jobs
-- so contractors can create time-and-materials estimates and invoices.
-- ============================================================================

alter table public.private_jobs
  add column if not exists job_type        text    not null default 'fixed'
    check (job_type in ('fixed', 'hourly')),
  add column if not exists hourly_rate     numeric,   -- £ per hour (hourly jobs only)
  add column if not exists estimated_hours numeric,   -- hours on the estimate
  add column if not exists actual_hours    numeric;   -- hours actually worked (filled before invoicing)

comment on column public.private_jobs.job_type        is 'fixed = priced quote; hourly = time-and-materials estimate';
comment on column public.private_jobs.hourly_rate     is 'Hourly charge rate in GBP (hourly jobs only)';
comment on column public.private_jobs.estimated_hours is 'Estimated hours used to build the initial estimate';
comment on column public.private_jobs.actual_hours    is 'Actual hours worked — set when invoice is raised for hourly jobs';
