# Pre-Cutover Test Checklist — fresh-start verification

Run this against your **new** Supabase project **before** switching the live app
over. The goal: prove every backend flow the app uses works on the fresh schema,
with **no migrated data**.

> **Keep the live app on OnSpace.** Point only a throwaway build at the new
> project — e.g. create `.env.local` with the new project's
> `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` (Expo loads
> `.env.local` and it's git-ignored), or run with the vars exported inline. Do
> **not** edit `.env`.

Prerequisites: `MIGRATION_RUNBOOK.md` steps 1–5 complete (schema applied, email
auth on, `ai-quote` deployed).

**Test accounts to create during the run:**
- **Account A** — a **contractor** (`account_type = contractor` or `both`).
- **Account B** — a **customer** (`account_type = customer`).

SQL snippets below are run in Dashboard → SQL Editor (service role, so they
bypass RLS — fine for verification). RLS itself is checked in §12.

---

## 1. Signup (email/password)

- [ ] In the app, sign up Account A with email + password + name, account type **contractor**.
- [ ] Sign up Account B as **customer**.
- [ ] Both signups return without error and land in the app (no email-confirmation
      wall if you disabled confirmation per runbook Step 4).
- [ ] Verify auth users exist:
  ```sql
  select id, email, raw_user_meta_data->>'username' as username,
         raw_user_meta_data->>'account_type' as account_type
  from auth.users order by created_at;
  ```

## 2. Profile row auto-creation (trigger)

- [ ] For **each** new user, a `user_profiles` row was created by `on_auth_user_created`:
  ```sql
  select id, email, username, account_type, onboarding_complete
  from public.user_profiles order by created_at;
  ```
- [ ] `username` and `account_type` match what was entered at signup; `onboarding_complete = false`.

## 3. Onboarding update

- [ ] Complete onboarding in-app for Account A (set display name, city, postcode, trades, rate, tax rate).
- [ ] The profile **updates** (not duplicates) and trial fields populate for contractor:
  ```sql
  select username, city, postcode_area, trades, hourly_rate_from, tax_rate,
         onboarding_complete, subscription_status, trial_started_at, trial_ends_at
  from public.user_profiles where id = '<A_id>';
  ```
- [ ] `onboarding_complete = true`; `subscription_status = 'free_trial'`; `trial_ends_at ≈ now + 14 days`.
- [ ] Complete onboarding for Account B (customer); expect `subscription_status = 'active'`.

## 4. Post a job

- [ ] As Account B (customer), post a marketplace job (title, description, trade, budget, city, postcode).
- [ ] Row created and owned by B:
  ```sql
  select id, client_id, title, trade, status, budget from public.job_posts;
  -- client_id = B_id, status = 'open'
  ```
- [ ] In the app marketplace, the job appears with the poster's name/avatar
      (verifies the `job_posts → user_profiles!job_posts_client_id_fkey` embed).

## 5. Apply (contractor quote)

- [ ] As Account A (contractor), apply to B's job with a quote amount + ETA + message.
- [ ] Row created:
  ```sql
  select id, job_post_id, contractor_id, quote_amount, eta_days, status
  from public.job_applications;   -- contractor_id = A_id, status = 'pending'
  ```
- [ ] **Unique constraint:** applying a second time to the same job as A is blocked
      (app shows "You have already applied for this job" — the `23505` path).

## 6. Accept the quote

- [ ] As Account B, accept A's application (confirm the fee-breakdown dialog → "Pay").
- [ ] Application + post statuses update:
  ```sql
  select status from public.job_applications where contractor_id = '<A_id>';  -- 'accepted'
  select status from public.job_posts where client_id = '<B_id>';             -- 'in_progress'
  ```

## 7. private_jobs created from acceptance

- [ ] A `private_jobs` row was created for the contractor (A) by the accepting customer (B):
  ```sql
  select id, contractor_id, title, customer, status, total, labour, materials,
         source_job_post_id from public.private_jobs;
  -- contractor_id = A_id, status = 'accepted', source_job_post_id = the job_post id
  ```
- [ ] This confirms the `private_jobs` insert policy (customer may insert a job for
      the contractor because they own the originating `source_job_post_id`).

## 8. Manual income (Tax Pot)

- [ ] As Account A, add a manual income entry (amount, date, category, paid).
- [ ] Row created with computed tax set-aside:
  ```sql
  select amount, date, category, payment_status, tax_rate, tax_set_aside
  from public.manual_income where contractor_id = '<A_id>';
  ```
- [ ] In-app Tax Pot summary reflects the new income (totals/set-aside update).

## 9. Review (contractor → customer)

- [ ] As Account A, leave a structured review of Account B for the completed job
      (overall stars, some category ratings, tags, would-work-again).
- [ ] Row created:
  ```sql
  select author_id, subject_id, mode, rating, categories, tags, would_work_again, status
  from public.reviews;
  -- author_id = A_id, subject_id = B_id, mode = 'contractor_to_customer', status = 'published'
  ```
- [ ] **Unique constraint:** submitting the same review again is blocked
      (app shows "Already reviewed" — `23505`).

## 10. Reliability score (view)

- [ ] The `customer_reliability_scores` view aggregates the review for Account B:
  ```sql
  select * from public.customer_reliability_scores where customer_id = '<B_id>';
  -- total_reviews = 1, avg_overall_rating matches the stars given,
  -- would_work_again_pct = 100 (if toggled on), common_tags includes selected tags,
  -- avg_* category columns reflect the category ratings
  ```
- [ ] In-app: viewing B in a contractor context shows the reliability badge
      consistent with the above (verifies `useReliability` reads the view).

## 11. delete_own_account (RPC)

> Use a **disposable** third account for this so it doesn't disturb A/B mid-run.

- [ ] Sign up Account C, then use the in-app "delete account" action.
- [ ] The RPC removes the auth user and cascades to the profile:
  ```sql
  select count(*) from auth.users where id = '<C_id>';            -- 0
  select count(*) from public.user_profiles where id = '<C_id>';  -- 0 (cascade)
  ```

## 12. RLS spot-check

Confirm policies actually isolate data. Easiest from the app with two logged-in
sessions, or via the REST API using each user's **anon-context** JWT (not the
service role).

- [ ] **Private data isolation:** Account B (customer) cannot read Account A's
      `private_jobs` or `manual_income`. As B, a select returns **0 rows** (not an error):
  - In app: B has no contractor Tax Pot / private jobs visibility.
  - Via API: `GET /rest/v1/private_jobs` as B returns `[]`.
- [ ] **Profiles are public-readable:** any authenticated user (and the public
      `/contractor/{id}` web route) can read `user_profiles` — expected, by design.
- [ ] **Reviews:** published reviews are readable; `private_note` is **not** exposed
      to anyone but the author. As B, selecting the review of B shows no
      `private_note` content authored by A.
- [ ] **Admin writes are blocked from the client (service-role only):**
  - [ ] As any normal authenticated user, attempting to resolve a dispute
        (`update disputes set status='resolved' …`) is **rejected / affects 0 rows**.
  - [ ] As any normal authenticated user, attempting to remove a review
        (`update reviews set status='removed' …` on someone else's review) is
        **rejected / affects 0 rows**.
  - [ ] The same operations succeed only with the **service_role** key.
        > This is expected: dispute resolution and review moderation are admin-only
        > by design and have no client path in the app.

---

## Exit criteria

- [ ] §§1–11 all pass (every flow works on the fresh schema).
- [ ] §12 confirms isolation and that admin-only writes are not client-reachable.
- [ ] `ai-quote` smoke test from `MIGRATION_RUNBOOK.md` Step 5 returns 200.

Only when all of the above pass should you proceed to cutover
(`MIGRATION_CHECKLIST.md` Step 7) — the one-time swap of the two `EXPO_PUBLIC_*`
vars to the new project.
