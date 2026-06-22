-- Make PUBLISHED portfolio projects publicly viewable (for the public
-- /contractor/{id} web profile) and allow owners to write to a PUBLIC
-- `portfolio` storage bucket (public read is automatic for public buckets;
-- writes still need RLS).
-- NOTE: also create a PUBLIC storage bucket named `portfolio` in the dashboard.
-- Idempotent: safe to re-run.

-- Anyone (incl. anonymous web visitors) can read PUBLISHED projects.
drop policy if exists "Portfolio projects: public read published" on public.portfolio_projects;
create policy "Portfolio projects: public read published"
  on public.portfolio_projects for select
  using (published = true);

-- Owner can write their own objects in the public `portfolio` bucket
-- (path convention: {auth.uid()}/{project_id}/{n}.jpg).
drop policy if exists "Portfolio media: owner can upload" on storage.objects;
create policy "Portfolio media: owner can upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'portfolio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Portfolio media: owner can update" on storage.objects;
create policy "Portfolio media: owner can update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'portfolio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Portfolio media: owner can delete" on storage.objects;
create policy "Portfolio media: owner can delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'portfolio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
