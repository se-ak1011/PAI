-- Contractor verification: let tradespeople submit proof (insurance, trade
-- qualification, ID) so they can earn a "Verified" badge shown to customers.
-- Self-declared accounts stay 'unverified'; submitting docs moves them to
-- 'pending'; an admin sets 'verified' (or 'rejected') after review.
-- Idempotent: safe to run more than once.

alter table public.user_profiles
  add column if not exists verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  add column if not exists verification_docs text[] not null default '{}',
  add column if not exists verification_submitted_at timestamptz;

-- PRIVATE `verification-docs` bucket: only the owner (and the service role, for
-- admin review) can read/write their documents. Path: {auth.uid()}/{file}.
drop policy if exists "Verification docs: owner can upload" on storage.objects;
create policy "Verification docs: owner can upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Verification docs: owner can read" on storage.objects;
create policy "Verification docs: owner can read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Verification docs: owner can delete" on storage.objects;
create policy "Verification docs: owner can delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
