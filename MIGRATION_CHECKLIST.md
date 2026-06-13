# Migration Checklist — OnSpace → your own Supabase project

Exact steps to move PAI from the OnSpace-hosted Supabase-compatible backend to a
standalone Supabase project you own. See [`BACKEND.md`](./BACKEND.md) for context.

> **This checklist is not yet executed.** The live backend, `.env`, edge function
> deployment, and auth config are all **unchanged**. Work through it deliberately;
> the cutover is a single, reversible config change (Step 7).

---

## 0. Prerequisites

- [ ] A Supabase account and organization.
- [ ] [Supabase CLI](https://supabase.com/docs/guides/cli) installed
      (`supabase --version`).
- [ ] Repo cloned locally with these migrations present under
      `supabase/migrations/`.
- [ ] An OpenAI API key (for the `ai-quote` edge function).
- [ ] Google OAuth client credentials (if keeping Google sign-in).
- [ ] Read access to the current OnSpace data if you intend to migrate rows.

---

## 1. Create the standalone Supabase project

- [ ] Create a new project at <https://supabase.com/dashboard>. Choose a region
      close to your users.
- [ ] Record from **Project Settings → API**:
  - [ ] Project URL → will become `EXPO_PUBLIC_SUPABASE_URL`
  - [ ] `anon` public key → will become `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `service_role` key → **server/CLI only; never ship in the app**
- [ ] (Optional, for CLI) link the repo:
      ```bash
      supabase login
      supabase link --project-ref <your-project-ref>
      ```

---

## 2. Apply the schema migrations (in order)

The four files are additive and idempotent. Apply them **in lexical order**:

```
supabase/migrations/20260613000001_initial_schema.sql
supabase/migrations/20260613000002_customer_reliability_scores.sql
supabase/migrations/20260613000003_delete_own_account.sql
supabase/migrations/20260613000004_rls_policies.sql
```

Choose one method:

- **CLI (recommended):**
  - [ ] `supabase db push`
- **SQL editor:**
  - [ ] Paste and run each file's contents, oldest first, one at a time.

Verify:

- [ ] Tables exist: `user_profiles`, `job_posts`, `job_applications`,
      `private_jobs`, `reviews`, `manual_income`, `disputes`.
- [ ] View exists: `customer_reliability_scores`.
- [ ] Function exists: `delete_own_account()`.
- [ ] Trigger exists: `on_auth_user_created` on `auth.users`.
- [ ] RLS is **enabled** on all seven tables and policies are listed
      (Dashboard → Authentication → Policies).

---

## 3. Configure Auth providers

> Provider settings live in the Supabase dashboard, **not** in this repo. Do not
> change anything in `contexts/AuthContext.tsx` or `template/core/` — the client
> code is already correct.

- [ ] **Email/password:** Authentication → Providers → Email → enabled. Decide on
      email confirmation (the app's signup flow assumes a session is usable
      promptly; match your previous OnSpace behavior).
- [ ] **Google OAuth:** Authentication → Providers → Google → enabled; paste the
      Google client ID/secret. The app calls `signInWithOAuth({ provider: 'google' })`
      with PKCE.
- [ ] **Redirect URLs:** add the app's web origin and the custom scheme
      `onspaceapp://` (from `app.json`) under Authentication → URL Configuration.
- [ ] Confirm the **signup → profile** path works: creating a user must fire
      `on_auth_user_created` and insert a `user_profiles` row (Step 2 trigger).

---

## 4. Deploy the `ai-quote` edge function

> Deferred per current instructions — do this only when you are ready to cut over.

- [ ] Set the secret:
      ```bash
      supabase secrets set OPENAI_API_KEY=sk-...
      ```
- [ ] Deploy:
      ```bash
      supabase functions deploy ai-quote
      ```
- [ ] Smoke test `supabase.functions.invoke('ai-quote', { body: { jobTitle, jobDescription } })`
      returns `{ data: {...} }`.

---

## 5. Migrate existing data (only if carrying data over)

If you are starting fresh, skip this section.

- [ ] Export from OnSpace (CSV/SQL dump per table, or `pg_dump` if accessible).
- [ ] Import in **dependency order** so foreign keys resolve:
  1. `auth.users` (and their `user_profiles` rows — note the trigger will try to
     create profiles; import users first, then upsert profile detail).
  2. `job_posts`
  3. `job_applications`, `private_jobs`, `reviews`, `manual_income`, `disputes`
- [ ] Re-check sequences / IDs are UUIDs (they are; no serial sequences to reset).
- [ ] Spot-check row counts per table against OnSpace.

---

## 6. Pre-cutover verification (against the new project, before repointing)

Run these with a throwaway `.env.local` or a temporary build so the live app is
untouched:

- [ ] Sign up → confirm a `user_profiles` row is created.
- [ ] Complete onboarding → profile `UPDATE` succeeds.
- [ ] Post a job, apply as a contractor, accept a quote → `private_jobs` row created.
- [ ] Add manual income → appears in Tax Pot.
- [ ] Submit a contractor→customer review → `customer_reliability_scores`
      reflects it.
- [ ] `delete_own_account()` removes the user and cascades.
- [ ] Confirm RLS: a user cannot read another user's `private_jobs` /
      `manual_income`, and cannot resolve disputes / remove reviews from the
      client (those are service-role only — expected to fail).

---

## 7. Cut over (the single config change — DEFERRED)

> **Do not perform this step until explicitly approved.** It is the only step
> that switches the live backend, and it is reversible by restoring the old
> values.

- [ ] In `.env`, set:
  - [ ] `EXPO_PUBLIC_SUPABASE_URL=<new project URL>`
  - [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY=<new anon key>`
- [ ] Rebuild / restart Expo so the new env is picked up.
- [ ] Re-run the Step 6 checks against the live app.

---

## 8. Post-cutover

- [ ] Monitor logs (Auth, Postgres, Edge Functions) for the first hours.
- [ ] Keep OnSpace read-only as a fallback until confident.
- [ ] Decommission OnSpace once verified.

---

## Explicitly out of scope

- **Stripe payments** — stubbed in the app (no server, no live integration);
  unaffected by the backend move and requires separate work.
- **Storage buckets** — none used; image fields are URL strings.
- **Admin role** — dispute resolution and review moderation remain service-role
  only by design. Add an `is_admin` claim/policy later if those screens should
  work from the client.
