-- Work progress photos for private jobs.
-- Adds a column to store uploaded photo paths + RLS policies for the PRIVATE
-- `job-photos` storage bucket.
--
-- Path convention used by the app:  {auth.uid()}/{job_id}/{filename}
-- => each user can only read/write objects inside their own top-level folder.
-- Idempotent: safe to run more than once.

-- 1) Column on private_jobs holding the uploaded object paths.
alter table public.private_jobs
  add column if not exists progress_photos text[] not null default '{}';

-- 2) Storage RLS policies for the 'job-photos' bucket (owner-scoped).
drop policy if exists "Job photos: owner can upload" on storage.objects;
create policy "Job photos: owner can upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'job-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Job photos: owner can read" on storage.objects;
create policy "Job photos: owner can read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'job-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Job photos: owner can delete" on storage.objects;
create policy "Job photos: owner can delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'job-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
