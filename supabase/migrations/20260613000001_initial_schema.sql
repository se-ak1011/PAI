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
