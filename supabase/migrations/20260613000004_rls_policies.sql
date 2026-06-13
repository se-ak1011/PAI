-- ============================================================================
-- Row Level Security policies
-- ============================================================================
-- These policies enable the data flows actually performed by the app while
-- keeping per-user data scoped to its owner. They match how the Supabase
-- client is used (auth.uid() == the signed-in user).
--
-- ADMIN CAVEAT: app/admin-disputes.tsx performs moderation (resolving disputes,
-- removing/restoring reviews) through the ordinary authenticated client, but the
-- codebase has no admin role/claim to gate on. To avoid granting every user the
-- ability to mutate others' disputes/reviews, those moderation writes are NOT
-- permitted to plain authenticated users here — they must run with the service
-- role (or after an is_admin mechanism is introduced). All normal user-facing
-- flows below work under RLS as-is.
-- ============================================================================

alter table public.user_profiles    enable row level security;
alter table public.job_posts         enable row level security;
alter table public.job_applications  enable row level security;
alter table public.private_jobs      enable row level security;
alter table public.reviews           enable row level security;
alter table public.manual_income     enable row level security;
alter table public.disputes          enable row level security;

-- ----------------------------------------------------------------------------
-- user_profiles
--   * Public read (marketplace listing + public /contractor/{id} web links).
--   * A user may insert/update only their own row (insert also covered by the
--     handle_new_user trigger, which runs as definer).
-- ----------------------------------------------------------------------------
drop policy if exists user_profiles_select_all  on public.user_profiles;
drop policy if exists user_profiles_insert_self on public.user_profiles;
drop policy if exists user_profiles_update_self on public.user_profiles;

create policy user_profiles_select_all
  on public.user_profiles for select
  using (true);

create policy user_profiles_insert_self
  on public.user_profiles for insert
  with check (auth.uid() = id);

create policy user_profiles_update_self
  on public.user_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- job_posts
--   * Anyone (incl. anon) can read the marketplace.
--   * The client owner can create/update/delete their own posts. (Accepting a
--     quote sets job_posts.status and is done by the post owner.)
-- ----------------------------------------------------------------------------
drop policy if exists job_posts_select_all    on public.job_posts;
drop policy if exists job_posts_insert_owner  on public.job_posts;
drop policy if exists job_posts_update_owner  on public.job_posts;
drop policy if exists job_posts_delete_owner  on public.job_posts;

create policy job_posts_select_all
  on public.job_posts for select
  using (true);

create policy job_posts_insert_owner
  on public.job_posts for insert
  with check (auth.uid() = client_id);

create policy job_posts_update_owner
  on public.job_posts for update
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

create policy job_posts_delete_owner
  on public.job_posts for delete
  using (auth.uid() = client_id);

-- ----------------------------------------------------------------------------
-- job_applications
--   * Visible to the applying contractor and to the owner of the job_post.
--   * A contractor inserts their own quote.
--   * Update allowed to the contractor (their own) or the post owner
--     (accept/reject sets status).
-- ----------------------------------------------------------------------------
drop policy if exists job_applications_select       on public.job_applications;
drop policy if exists job_applications_insert_self  on public.job_applications;
drop policy if exists job_applications_update       on public.job_applications;

create policy job_applications_select
  on public.job_applications for select
  using (
    auth.uid() = contractor_id
    or exists (
      select 1 from public.job_posts p
      where p.id = job_post_id and p.client_id = auth.uid()
    )
  );

create policy job_applications_insert_self
  on public.job_applications for insert
  with check (auth.uid() = contractor_id);

create policy job_applications_update
  on public.job_applications for update
  using (
    auth.uid() = contractor_id
    or exists (
      select 1 from public.job_posts p
      where p.id = job_post_id and p.client_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- private_jobs
--   * Read/update/delete restricted to the owning contractor.
--   * Insert by the owning contractor OR by the customer accepting a quote
--     (who owns the originating job_post -> source_job_post_id).
-- ----------------------------------------------------------------------------
drop policy if exists private_jobs_select_owner on public.private_jobs;
drop policy if exists private_jobs_insert       on public.private_jobs;
drop policy if exists private_jobs_update_owner on public.private_jobs;
drop policy if exists private_jobs_delete_owner on public.private_jobs;

create policy private_jobs_select_owner
  on public.private_jobs for select
  using (auth.uid() = contractor_id);

create policy private_jobs_insert
  on public.private_jobs for insert
  with check (
    auth.uid() = contractor_id
    or exists (
      select 1 from public.job_posts p
      where p.id = source_job_post_id and p.client_id = auth.uid()
    )
  );

create policy private_jobs_update_owner
  on public.private_jobs for update
  using (auth.uid() = contractor_id)
  with check (auth.uid() = contractor_id);

create policy private_jobs_delete_owner
  on public.private_jobs for delete
  using (auth.uid() = contractor_id);

-- ----------------------------------------------------------------------------
-- reviews
--   * Published reviews are readable by everyone; an author can always read
--     their own (incl. removed). private_note is therefore only exposed to the
--     author (and the service role for moderation).
--   * An author inserts/updates only their own reviews.
-- ----------------------------------------------------------------------------
drop policy if exists reviews_select        on public.reviews;
drop policy if exists reviews_insert_author on public.reviews;
drop policy if exists reviews_update_author on public.reviews;

create policy reviews_select
  on public.reviews for select
  using (status = 'published' or auth.uid() = author_id);

create policy reviews_insert_author
  on public.reviews for insert
  with check (auth.uid() = author_id);

create policy reviews_update_author
  on public.reviews for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

-- ----------------------------------------------------------------------------
-- manual_income
--   * Fully scoped to the owning contractor.
-- ----------------------------------------------------------------------------
drop policy if exists manual_income_owner on public.manual_income;

create policy manual_income_owner
  on public.manual_income for all
  using (auth.uid() = contractor_id)
  with check (auth.uid() = contractor_id);

-- ----------------------------------------------------------------------------
-- disputes
--   * Readable by the involved contractor or customer.
--   * Either party may file (insert) a dispute they are part of.
--   * Resolution (update) is admin-only -> service role (see ADMIN CAVEAT).
-- ----------------------------------------------------------------------------
drop policy if exists disputes_select_party on public.disputes;
drop policy if exists disputes_insert_party on public.disputes;

create policy disputes_select_party
  on public.disputes for select
  using (auth.uid() = contractor_id or auth.uid() = customer_id);

create policy disputes_insert_party
  on public.disputes for insert
  with check (auth.uid() = contractor_id or auth.uid() = customer_id);
