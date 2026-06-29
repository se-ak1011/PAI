-- Invoice task breakdown. A job/invoice can itemise multiple tasks (e.g. plumbing
-- in one place, labouring in another — same client, same day), each with its own
-- date, location, hours and rate. They roll up into the labour total; the invoice
-- can show them itemised or collapsed to a summary.
-- Idempotent: safe to run more than once.
--
-- Shape of each element:
--   { "date": "2026-06-27", "location": "Beeny Barn", "description": "Labouring",
--     "hours": 64, "rate": 22.31 }   -- amount is hours * rate
alter table public.private_jobs
  add column if not exists line_items jsonb not null default '[]'::jsonb;
