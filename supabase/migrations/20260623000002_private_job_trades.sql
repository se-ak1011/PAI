-- Persist the trade(s) a job spans on the job record itself.
-- Until now, trades selected on the New Job / Create Invoice screens were used
-- only to prompt the AI and were not stored. This adds the column so the saved
-- job keeps the trades it covers (a job can span several, e.g. plumbing + tiling).
-- Idempotent: safe to run more than once.

alter table public.private_jobs
  add column if not exists trades text[] not null default '{}';
