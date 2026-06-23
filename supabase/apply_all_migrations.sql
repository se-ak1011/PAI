-- ============================================================================
-- apply_all_migrations.sql — full PAI schema, idempotent, run-once in SQL editor
-- Concatenation of EVERY migration in supabase/migrations/ in order:
--   20260613000001_initial_schema
--   20260613000002_customer_reliability_scores
--   20260613000003_delete_own_account
--   20260613000004_rls_policies
--   20260614000001_hourly_jobs                 (private_jobs.job_type etc.)
--   20260622000001_job_progress_photos         (private_jobs.progress_photos + storage)
--   20260622000002_expenses_receipt_vault      (expenses table + storage)
--   20260622000003_portfolio_projects          (portfolio_projects table)
--   20260622000004_public_portfolio            (public read + portfolio storage)
--   20260622000005_branding_logo               (user_profiles.logo_url)
--   20260623000001_storage_buckets             (job-photos, receipts, portfolio buckets)
--   20260623000002_private_job_trades          (private_jobs.trades)
-- Safe to re-run (create if not exists / create or replace / drop policy if exists /
-- add column if not exists / on conflict do nothing).
--
-- ⚠️ If your project was created from an OLDER copy of this file (one that stopped
-- at ...0004), it is MISSING the hourly_jobs columns — which makes EVERY job/invoice
-- insert fail. Re-running this whole file fixes that. It is additive and safe.
-- ============================================================================

-- ==================== 20260613000001_initial_schema ====================
-- ============================================================================
-- PAI — Initial schema (reconstructed from application code)
-- ============================================================================
-- This migration reconstructs the minimum database schema required by the app
-- as exercised through the Supabase client in:
--   contexts/AuthContext.tsx, contexts/JobsContext.tsx, contexts/TaxPotContext.tsx,
--   hooks/useReliability.tsx, components/feature/CustomerReviewModal.tsx,
--   app/(tabs)/marketplace.tsx, app/(tabs)/profile.tsx, app/contractor-profile.tsx,
--   app/marketplace-job.tsx, app/job-detail.tsx, app/admin-disputes.tsx.
--
-- Tables: user_profiles, job_posts, job_applications, private_jobs, reviews,
--         manual_income, disputes.
-- (customer_reliability_scores is a VIEW — see 20260613000002.)
-- (delete_own_account is an RPC — see 20260613000003.)
-- (Row Level Security policies — see 20260613000004.)
--
-- No storage buckets are used: avatar_url / portfolio_images are plain URL strings.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- user_profiles
-- One row per auth user. Created automatically on signup via handle_new_user().
-- Read app-wide via AuthContext.fetchProfile() and the marketplace listing.
-- ----------------------------------------------------------------------------
create table if not exists public.user_profiles (
  id                          uuid primary key references auth.users (id) on delete cascade,
  email                       text,
  username                    text,
  account_type                text not null default 'contractor'
                                check (account_type in ('contractor', 'customer', 'both')),
  business_name               text,
  bio                         text,
  trades                      text[]  not null default '{}',
  hourly_rate_from            numeric,
  hourly_rate                 numeric,
  city                        text,
  postcode_area               text,
  avatar_url                  text,
  tax_rate                    numeric not null default 30,
  available                   boolean not null default true,
  onboarding_complete         boolean not null default false,
  preferred_shop              text,
  flexible_pricing            boolean not null default false,
  customer_profile_complete   boolean not null default false,
  -- Subscription / trial
  subscription_status         text not null default 'free_trial'
                                check (subscription_status in ('free_trial', 'active', 'past_due', 'cancelled')),
  trial_ends_at               timestamptz,
  trial_started_at            timestamptz,
  stripe_customer_id          text,
  -- Saved marketplace preferences
  saved_trades                text[] not null default '{}',
  saved_postcode_areas        text[] not null default '{}',
  -- Portfolio / links
  portfolio_images            text[] not null default '{}',
  website                     text,
  social_links                jsonb  not null default '{}'::jsonb,
  availability_days           text[] not null default array['Mon','Tue','Wed','Thu','Fri'],
  created_at                  timestamptz not null default now()
);

create index if not exists user_profiles_onboarding_idx
  on public.user_profiles (onboarding_complete);

-- ----------------------------------------------------------------------------
-- job_posts
-- Public marketplace jobs posted by customers (client_id).
-- Joined as user_profiles!job_posts_client_id_fkey and job_applications(id).
-- ----------------------------------------------------------------------------
create table if not exists public.job_posts (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.user_profiles (id) on delete cascade,
  title           text not null,
  description     text,
  trade           text,
  status          text not null default 'open',   -- open | in_progress | ...
  budget          numeric,
  city            text,
  postcode_area   text,
  photo_url       text,
  ai_scope        text,
  ai_materials    text[],
  created_at      timestamptz not null default now()
);

-- Named explicitly so PostgREST embedding job_posts!job_posts_client_id_fkey resolves.
alter table public.job_posts
  drop constraint if exists job_posts_client_id_fkey;
alter table public.job_posts
  add constraint job_posts_client_id_fkey
  foreign key (client_id) references public.user_profiles (id) on delete cascade;

create index if not exists job_posts_client_id_idx on public.job_posts (client_id);
create index if not exists job_posts_status_idx    on public.job_posts (status);

-- ----------------------------------------------------------------------------
-- job_applications
-- A contractor's quote against a job_post. One quote per contractor per post.
-- Joined as contractor:contractor_id(...).
-- ----------------------------------------------------------------------------
create table if not exists public.job_applications (
  id            uuid primary key default gen_random_uuid(),
  job_post_id   uuid not null references public.job_posts (id) on delete cascade,
  contractor_id uuid not null references public.user_profiles (id) on delete cascade,
  quote_amount  numeric not null,
  eta_days      integer,
  message       text,
  status        text not null default 'pending',  -- pending | accepted | rejected
  created_at    timestamptz not null default now(),
  constraint job_applications_unique_quote unique (job_post_id, contractor_id)
);

create index if not exists job_applications_job_post_id_idx   on public.job_applications (job_post_id);
create index if not exists job_applications_contractor_id_idx on public.job_applications (contractor_id);

-- ----------------------------------------------------------------------------
-- private_jobs
-- A contractor's private job ledger (also fed by accepted marketplace quotes).
-- Drives invoices and PAI income in the Tax Pot.
-- ----------------------------------------------------------------------------
create table if not exists public.private_jobs (
  id                  uuid primary key default gen_random_uuid(),
  contractor_id       uuid not null references public.user_profiles (id) on delete cascade,
  title               text not null,
  customer            text,
  description         text,
  status              text not null default 'draft',  -- draft | accepted | invoiced | paid | ...
  total               numeric not null default 0,
  labour              numeric not null default 0,
  materials           numeric not null default 0,
  vat                 numeric not null default 0,
  materials_items     jsonb   not null default '[]'::jsonb,  -- [{ name, qty, price }]
  receipts            text[]  not null default '{}',
  tax_rate            numeric,
  invoiced_at         timestamptz,
  paid_at             timestamptz,
  source_job_post_id  uuid references public.job_posts (id) on delete set null,
  created_at          timestamptz not null default now()
);

create index if not exists private_jobs_contractor_id_idx on public.private_jobs (contractor_id);
create index if not exists private_jobs_status_idx        on public.private_jobs (status);

-- ----------------------------------------------------------------------------
-- reviews
-- Structured two-way reviews. mode distinguishes direction.
-- contractor_to_customer reviews feed the customer_reliability_scores view.
-- One review per author/subject/job/mode.
-- ----------------------------------------------------------------------------
create table if not exists public.reviews (
  id               uuid primary key default gen_random_uuid(),
  author_id        uuid not null references public.user_profiles (id) on delete cascade,
  subject_id       uuid not null references public.user_profiles (id) on delete cascade,
  job_post_id      uuid references public.job_posts (id) on delete set null,
  mode             text not null
                     check (mode in ('contractor_to_customer', 'customer_to_contractor')),
  rating           integer not null check (rating between 1 and 5),
  categories       jsonb   not null default '{}'::jsonb,  -- { communication, payment_reliability, ... }
  tags             text[]  not null default '{}',
  would_work_again boolean,
  private_note     text,
  comment          text,
  status           text not null default 'published'
                     check (status in ('published', 'removed')),
  created_at       timestamptz not null default now(),
  constraint reviews_unique_per_job unique (author_id, subject_id, job_post_id, mode)
);

create index if not exists reviews_subject_mode_status_idx
  on public.reviews (subject_id, mode, status);
create index if not exists reviews_author_id_idx on public.reviews (author_id);

-- ----------------------------------------------------------------------------
-- manual_income
-- Manually-entered income rows for the Tax Pot (contractor-owned).
-- ----------------------------------------------------------------------------
create table if not exists public.manual_income (
  id             uuid primary key default gen_random_uuid(),
  contractor_id  uuid not null references public.user_profiles (id) on delete cascade,
  amount         numeric not null,
  date           date not null,
  customer_name  text,
  category       text,
  payment_status text not null default 'paid' check (payment_status in ('paid', 'unpaid')),
  tax_rate       numeric not null default 30,
  tax_set_aside  numeric not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists manual_income_contractor_id_idx on public.manual_income (contractor_id);

-- ----------------------------------------------------------------------------
-- disputes
-- Filed against a job between a contractor and a customer; resolved by admins.
-- Joined as contractor:contractor_id(...), customer:customer_id(...), job_post:job_post_id(...).
-- ----------------------------------------------------------------------------
create table if not exists public.disputes (
  id                  uuid primary key default gen_random_uuid(),
  job_post_id         uuid references public.job_posts (id) on delete set null,
  contractor_id       uuid not null references public.user_profiles (id) on delete cascade,
  customer_id         uuid not null references public.user_profiles (id) on delete cascade,
  filed_by            text not null check (filed_by in ('contractor', 'customer')),
  reason              text not null,
  status              text not null default 'open' check (status in ('open', 'resolved', 'closed')),
  resolution_note     text,
  resolution_outcome  text check (resolution_outcome in ('release_to_contractor', 'refund_customer')),
  resolved_by         uuid references public.user_profiles (id) on delete set null,
  resolved_at         timestamptz,
  amount              numeric not null default 0,
  created_at          timestamptz not null default now()
);

create index if not exists disputes_contractor_id_idx on public.disputes (contractor_id);
create index if not exists disputes_customer_id_idx   on public.disputes (customer_id);
create index if not exists disputes_status_idx        on public.disputes (status);

-- ----------------------------------------------------------------------------
-- handle_new_user()
-- AuthContext signs up via supabase.auth.signUp({ options: { data: { username,
-- account_type } } }) and thereafter UPDATEs user_profiles (never inserts), so a
-- profile row must exist immediately after signup. This trigger creates it,
-- seeding username / account_type from the auth metadata.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, username, account_type)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'username',
    coalesce(new.raw_user_meta_data ->> 'account_type', 'contractor')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ==================== 20260613000002_customer_reliability_scores ====================
-- ============================================================================
-- customer_reliability_scores (VIEW)
-- ============================================================================
-- Consumed by hooks/useReliability.tsx via:
--   .from('customer_reliability_scores').select('*').eq('customer_id', id).maybeSingle()
--
-- Aggregates published contractor_to_customer reviews into one row per customer.
-- Columns expected by the hook (all numeric values are read with parseFloat):
--   customer_id, total_reviews, avg_overall_rating, would_work_again_pct,
--   common_tags (text[]), avg_communication, avg_payment_reliability,
--   avg_project_preparedness, avg_scope_stability, avg_respectful_behaviour
--
-- Category scores live in reviews.categories (jsonb), e.g.
--   { "communication": 5, "payment_reliability": 4, ... }
--
-- This is intentionally a (non-invoker) view so contractors can read aggregate
-- reliability scores about customers without direct read access to the
-- underlying reviews rows (which may contain private_note). Access is granted
-- to authenticated/anon below; the raw reviews table stays RLS-protected.
-- ============================================================================

create or replace view public.customer_reliability_scores as
with base as (
  select *
  from public.reviews
  where mode = 'contractor_to_customer'
    and status = 'published'
),
tag_counts as (
  select subject_id, tag, count(*) as cnt
  from base, unnest(tags) as tag
  group by subject_id, tag
),
top_tags as (
  select subject_id, array_agg(tag order by cnt desc, tag) as common_tags
  from tag_counts
  group by subject_id
)
select
  b.subject_id                                                              as customer_id,
  count(*)::int                                                             as total_reviews,
  round(avg(b.rating)::numeric, 2)                                         as avg_overall_rating,
  round(
    100.0 * avg(
      case
        when b.would_work_again is true  then 1.0
        when b.would_work_again is false then 0.0
      end
    ), 0
  )                                                                         as would_work_again_pct,
  round(avg((b.categories ->> 'communication')::numeric), 2)               as avg_communication,
  round(avg((b.categories ->> 'payment_reliability')::numeric), 2)         as avg_payment_reliability,
  round(avg((b.categories ->> 'project_preparedness')::numeric), 2)        as avg_project_preparedness,
  round(avg((b.categories ->> 'scope_stability')::numeric), 2)             as avg_scope_stability,
  round(avg((b.categories ->> 'respectful_behaviour')::numeric), 2)        as avg_respectful_behaviour,
  coalesce(t.common_tags, '{}')                                            as common_tags
from base b
left join top_tags t on t.subject_id = b.subject_id
group by b.subject_id, t.common_tags;

grant select on public.customer_reliability_scores to anon, authenticated;

-- ==================== 20260613000003_delete_own_account ====================
-- ============================================================================
-- delete_own_account() (RPC)
-- ============================================================================
-- Called by AuthContext.deleteAccount() via supabase.rpc('delete_own_account').
-- Runs as SECURITY DEFINER so the anon/authenticated client can delete the
-- caller's own auth.users row. Deleting the auth user cascades to
-- public.user_profiles (and onward to that user's owned rows via their FKs).
-- ============================================================================

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Cascades to public.user_profiles (FK on delete cascade) and dependents.
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

-- ==================== 20260613000004_rls_policies ====================
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

-- ==================== 20260614000001_hourly_jobs ====================
-- Adds job_type, hourly_rate, estimated_hours, actual_hours to private_jobs so
-- contractors can create time-and-materials estimates and invoices.
-- ⚠️ These columns are inserted by CreateJobModal AND CreateInvoiceModal — without
-- them, every job/invoice save fails (this is the #1 cause of "nothing saves").
alter table public.private_jobs
  add column if not exists job_type        text    not null default 'fixed'
    check (job_type in ('fixed', 'hourly')),
  add column if not exists hourly_rate     numeric,
  add column if not exists estimated_hours numeric,
  add column if not exists actual_hours    numeric;

-- ==================== 20260622000001_job_progress_photos ====================
-- Column on private_jobs holding uploaded photo object paths + storage RLS for
-- the PRIVATE `job-photos` bucket. Path convention: {auth.uid()}/{job_id}/{file}.
alter table public.private_jobs
  add column if not exists progress_photos text[] not null default '{}';

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

-- ==================== 20260622000002_expenses_receipt_vault ====================
-- expenses table (Receipt Vault / claimable expenses) + RLS, plus storage policies
-- for the PRIVATE `receipts` bucket. Path convention: {auth.uid()}/{timestamp}.{ext}
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.private_jobs(id) on delete set null,
  vendor text,
  amount numeric not null default 0,
  category text,
  split text not null default 'business',
  business_pct int,
  confidence numeric,
  needs_review boolean not null default false,
  receipt_path text,
  note text,
  spent_on date,
  created_at timestamptz not null default now()
);

alter table public.expenses enable row level security;

drop policy if exists "Expenses: owner all" on public.expenses;
create policy "Expenses: owner all"
  on public.expenses for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Receipts: owner can upload" on storage.objects;
create policy "Receipts: owner can upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Receipts: owner can read" on storage.objects;
create policy "Receipts: owner can read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Receipts: owner can delete" on storage.objects;
create policy "Receipts: owner can delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ==================== 20260622000003_portfolio_projects ====================
-- Portfolio projects with completed-job photo references.
create table if not exists public.portfolio_projects (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'photo_library' check (source in ('completed_job', 'photo_library')),
  source_job_id uuid references public.private_jobs(id) on delete set null,
  title text not null,
  trade text,
  location text,
  description text,
  photos jsonb not null default '[]'::jsonb,
  cover_photo_path text,
  verified boolean not null default false,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint completed_job_projects_are_verified check (source <> 'completed_job' or verified = true),
  constraint manual_projects_are_not_verified check (source <> 'photo_library' or verified = false)
);

alter table public.portfolio_projects enable row level security;

drop policy if exists "Portfolio projects: owner can read" on public.portfolio_projects;
create policy "Portfolio projects: owner can read"
  on public.portfolio_projects for select
  using (auth.uid() = contractor_id);

drop policy if exists "Portfolio projects: owner can insert" on public.portfolio_projects;
create policy "Portfolio projects: owner can insert"
  on public.portfolio_projects for insert
  with check (auth.uid() = contractor_id);

drop policy if exists "Portfolio projects: owner can update" on public.portfolio_projects;
create policy "Portfolio projects: owner can update"
  on public.portfolio_projects for update
  using (auth.uid() = contractor_id)
  with check (auth.uid() = contractor_id);

drop policy if exists "Portfolio projects: owner can delete" on public.portfolio_projects;
create policy "Portfolio projects: owner can delete"
  on public.portfolio_projects for delete
  using (auth.uid() = contractor_id);

-- ==================== 20260622000004_public_portfolio ====================
-- Published portfolio projects are publicly viewable; owners write to the PUBLIC
-- `portfolio` storage bucket. Path convention: {auth.uid()}/{project_id}/{n}.jpg
drop policy if exists "Portfolio projects: public read published" on public.portfolio_projects;
create policy "Portfolio projects: public read published"
  on public.portfolio_projects for select
  using (published = true);

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

-- ==================== 20260622000005_branding_logo ====================
-- Optional business logo for contractors (shown on quotes/invoices + public profile).
alter table public.user_profiles
  add column if not exists logo_url text;

-- ==================== 20260623000002_private_job_trades ====================
-- Persist the trade(s) a job spans (used by the AI prompt + shown on the job).
alter table public.private_jobs
  add column if not exists trades text[] not null default '{}';

-- ==================== storage buckets ====================
-- Create the buckets the app uploads to, so storage works without manual dashboard
-- steps. `job-photos` + `receipts` are PRIVATE (owner-scoped reads via the policies
-- above); `portfolio` is PUBLIC (anyone can read published portfolio media + logos).
insert into storage.buckets (id, name, public)
values
  ('job-photos', 'job-photos', false),
  ('receipts',   'receipts',   false),
  ('portfolio',  'portfolio',  true)
on conflict (id) do nothing;

