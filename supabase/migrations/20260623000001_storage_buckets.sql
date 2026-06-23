-- Create the storage buckets the app uploads to, so storage works without manual
-- dashboard steps. Earlier migrations noted "also create this bucket in the
-- dashboard" — this makes that automatic and idempotent.
--
--   job-photos : PRIVATE — work progress photos (owner-scoped reads, see 20260622000001)
--   receipts   : PRIVATE — receipt vault images   (owner-scoped reads, see 20260622000002)
--   portfolio  : PUBLIC  — published portfolio media + business logos (see 20260622000004)
--
-- The owner-scoped RLS policies on storage.objects live in those migrations; this
-- only registers the buckets. Idempotent: safe to run more than once.

insert into storage.buckets (id, name, public)
values
  ('job-photos', 'job-photos', false),
  ('receipts',   'receipts',   false),
  ('portfolio',  'portfolio',  true)
on conflict (id) do nothing;
