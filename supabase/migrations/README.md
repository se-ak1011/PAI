# PAI — Reconstructed database schema

These migrations reconstruct the **minimum** Supabase schema required by the app,
derived entirely from how the Supabase client is used in the codebase. They are
additive and idempotent (`create table if not exists`, `create or replace`,
`drop policy if exists`), so they can be applied to a fresh project or layered
onto an existing one.

> Nothing here changes app config or switches backends — these are SQL artifacts
> only. The running app still points at whatever `EXPO_PUBLIC_SUPABASE_URL` /
> `EXPO_PUBLIC_SUPABASE_ANON_KEY` resolve to.

## Migration order

| File | Contents |
|------|----------|
| `20260613000001_initial_schema.sql` | Tables, constraints, indexes, `handle_new_user` signup trigger |
| `20260613000002_customer_reliability_scores.sql` | `customer_reliability_scores` aggregate **view** |
| `20260613000003_delete_own_account.sql` | `delete_own_account()` SECURITY DEFINER **RPC** |
| `20260613000004_rls_policies.sql` | RLS enablement + policies |
| `20260614000001_hourly_jobs.sql` | `private_jobs.job_type / hourly_rate / estimated_hours / actual_hours` |
| `20260622000001_job_progress_photos.sql` | `private_jobs.progress_photos` + `job-photos` storage policies |
| `20260622000002_expenses_receipt_vault.sql` | `expenses` table + `receipts` storage policies |
| `20260622000003_portfolio_projects.sql` | `portfolio_projects` table + owner RLS |
| `20260622000004_public_portfolio.sql` | public read of published projects + `portfolio` storage policies |
| `20260622000005_branding_logo.sql` | `user_profiles.logo_url` |
| `20260623000001_storage_buckets.sql` | Creates `job-photos`, `receipts`, `portfolio` storage buckets |
| `20260623000002_private_job_trades.sql` | `private_jobs.trades` (trades a job spans) |
| `20260623000003_contractor_verification.sql` | `user_profiles.verification_status` + docs + `verification-docs` bucket |
| `20260623000004_messaging.sql` | `conversations` + `messages` tables, gated to accepted jobs, + RLS |
| `20260623000005_job_schedule.sql` | `private_jobs.scheduled_date` + `location` (dashboard "Jobs of the Day") |
| `20260623000006_admin.sql` | `admins` table (no client writes) + `is_admin()` — admin panel access control |

> **Easiest path:** run `supabase/apply_all_migrations.sql` — it concatenates every
> file above (idempotent) **and** creates the `job-photos`, `receipts`, and
> `portfolio` storage buckets. Then run `supabase/verify_schema.sql` — every row
> should read **PASS**. If any reads FAIL, re-run `apply_all_migrations.sql`.
>
> ⚠️ An older `apply_all_migrations.sql` stopped at `…0004`, so projects created
> from it are **missing the `private_jobs.job_type` column** — which makes every
> job/invoice save fail silently. Re-running the current file fixes that.

## What was traced, and where

### Tables

| Object | Kind | Source references |
|--------|------|-------------------|
| `user_profiles` | table | `AuthContext` (`select *`, `update`, signup metadata), `marketplace.tsx`, `contractor-profile.tsx`, `TaxPotContext` (`tax_rate`) |
| `job_posts` | table | `JobsContext` (`select` w/ `user_profiles!job_posts_client_id_fkey` + `job_applications(id)`, `insert`), `marketplace-job.tsx` (`update status`), `job-detail.tsx` |
| `job_applications` | table | `marketplace-job.tsx` (`insert`, `update`, `select contractor:contractor_id(...)`) — unique `(job_post_id, contractor_id)` (app handles `23505`) |
| `private_jobs` | table | `JobsContext` (`select/insert/update/delete`), `marketplace-job.tsx` (`insert` on accept), `TaxPotContext` (paid-job income) |
| `reviews` | table | `CustomerReviewModal.tsx` (`insert`), `profile.tsx` / `contractor-profile.tsx` / `admin-disputes.tsx` (`select`/`update status`) — unique `(author_id, subject_id, job_post_id, mode)` |
| `manual_income` | table | `TaxPotContext` (`select/insert/delete`) |
| `disputes` | table | `admin-disputes.tsx` (`select` w/ joins, `update` resolution) |

### Other objects

| Object | Kind | Source references |
|--------|------|-------------------|
| `customer_reliability_scores` | view | `hooks/useReliability.tsx` — aggregates published `contractor_to_customer` reviews per customer |
| `handle_new_user()` | trigger fn | Implied: `AuthContext` only ever `UPDATE`s `user_profiles` after signup, so the row must be auto-created |
| `delete_own_account()` | rpc | `AuthContext.deleteAccount()` → `supabase.rpc('delete_own_account')` |

### PostgREST relationship embeddings relied upon

- `job_posts` → `user_profiles!job_posts_client_id_fkey(username, avatar_url)`
- `job_posts` → `job_applications(id)`
- `job_applications` → `contractor:contractor_id(username, city, trades, hourly_rate_from)`
- `reviews` → `author:author_id(username)`, `subject:subject_id(username)`
- `disputes` → `contractor:contractor_id(username)`, `customer:customer_id(username)`, `job_post:job_post_id(title)`

All are covered by the foreign keys above (PostgREST infers the embed names from them).

## Auth

- Email/password (`signInWithPassword`, `signUp`) and Google OAuth
  (`signInWithOAuth`, PKCE) — both are Supabase Auth provider settings, not schema.
- New users get a `user_profiles` row via the `on_auth_user_created` trigger,
  seeded from `raw_user_meta_data` (`username`, `account_type`).

## Storage

None. `avatar_url`, `photo_url`, `portfolio_images`, and `receipts` are plain
text URL strings — there are no `supabase.storage` calls anywhere in the app.

## Edge functions

`supabase/functions/ai-quote/index.ts` (called via `supabase.functions.invoke('ai-quote')`)
is application code, not database schema, so it is unchanged here. It needs
`OPENAI_API_KEY` set in the function environment.

## Known caveats

- **Admin moderation** (resolving disputes, removing/restoring reviews) is done
  through the ordinary authenticated client, but there is no admin role/claim in
  the codebase. To avoid letting every user mutate others' rows, those writes are
  left to the **service role** under RLS (`disputes` UPDATE and `reviews` status
  changes by non-authors). Introduce an `is_admin` mechanism to run them from the
  client.
- Status/text fields with open-ended values (`job_posts.status`,
  `private_jobs.status`) are kept as plain `text`; only fully-bounded sets use
  `CHECK` constraints.
