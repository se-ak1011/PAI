# Migration Runbook — apply PAI's schema to your new Supabase project

A focused, do-this-now guide for standing up a **fresh** Supabase project from
the migrations already in this repo, then deploying the `ai-quote` function.

This is the **fresh-start** path:

- ✅ Brand-new, empty Supabase project — **no data is migrated** from OnSpace.
- ✅ **Email/password auth only** for launch.
- ⏸️ **Google OAuth deferred** — not on the critical path (see step 4).
- ⏸️ **Stripe/subscriptions stay stubbed** — nothing to configure.
- 🔒 **The app stays pointed at OnSpace** throughout this runbook. The cutover
  (swapping the two `EXPO_PUBLIC_*` vars) is intentionally **not** part of it —
  do that only after `PRE_CUTOVER_TEST_CHECKLIST.md` passes.

Companion docs: [`BACKEND.md`](./BACKEND.md) (architecture),
[`MIGRATION_CHECKLIST.md`](./MIGRATION_CHECKLIST.md) (full lifecycle),
[`PRE_CUTOVER_TEST_CHECKLIST.md`](./PRE_CUTOVER_TEST_CHECKLIST.md) (verification),
[`supabase/migrations/README.md`](./supabase/migrations/README.md) (query→object trace).

---

## What gets created

Applying the four migrations (in order) produces:

| Order | File | Creates |
|-------|------|---------|
| 1 | `supabase/migrations/20260613000001_initial_schema.sql` | 7 tables (`user_profiles`, `job_posts`, `job_applications`, `private_jobs`, `reviews`, `manual_income`, `disputes`) + constraints, indexes, and the `on_auth_user_created` signup trigger |
| 2 | `supabase/migrations/20260613000002_customer_reliability_scores.sql` | `customer_reliability_scores` view |
| 3 | `supabase/migrations/20260613000003_delete_own_account.sql` | `delete_own_account()` RPC |
| 4 | `supabase/migrations/20260613000004_rls_policies.sql` | RLS enabled + policies on all 7 tables |

The files are additive and idempotent, so re-running them is safe.

---

## Step 0 — Prerequisites

- [ ] A Supabase account + organization.
- [ ] This repo cloned locally with `supabase/migrations/` present.
- [ ] (CLI path only) [Supabase CLI](https://supabase.com/docs/guides/cli) installed — `supabase --version`.
- [ ] An OpenAI API key for the `ai-quote` function.

---

## Step 1 — Create the project

1. [ ] Dashboard → **New project**. Pick a region near your users; set a strong DB password.
2. [ ] Wait for provisioning to finish.
3. [ ] **Project Settings → API**, record:
   - [ ] **Project URL** → later becomes `EXPO_PUBLIC_SUPABASE_URL`
   - [ ] **anon public key** → later becomes `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - [ ] **service_role key** → server/CLI only; **never** put in the app or `.env`

> Record these somewhere safe but **do not edit the app's `.env` yet** — the app
> remains on OnSpace until verification passes.

---

## Step 2 — Apply the migrations (choose ONE method)

### Method A — SQL editor (no tooling)

Apply the four files **oldest first, one at a time**:

1. [ ] Open Dashboard → **SQL Editor → New query**.
2. [ ] Paste the entire contents of `20260613000001_initial_schema.sql`, run it.
3. [ ] Repeat for `…0002_customer_reliability_scores.sql`.
4. [ ] Repeat for `…0003_delete_own_account.sql`.
5. [ ] Repeat for `…0004_rls_policies.sql`.

Each should complete with no errors. Order matters (the view/RPC/policies depend
on the tables from step 1).

### Method B — Supabase CLI (recommended, repeatable)

```bash
supabase login
supabase link --project-ref <your-project-ref>   # from the project's URL/settings
supabase db push                                  # applies everything in supabase/migrations/ in order
```

> `db push` reads `supabase/migrations/` and applies pending migrations in
> lexical order. No `supabase/config.toml` is required for `link` + `db push`,
> but if the CLI prompts for one, run `supabase init` first (it won't change app code).

---

## Step 3 — Verify the schema landed

In SQL Editor (or `supabase db diff`):

- [ ] **Tables (7):**
  ```sql
  select table_name from information_schema.tables
  where table_schema = 'public' order by table_name;
  -- expect: disputes, job_applications, job_posts, manual_income,
  --         private_jobs, reviews, user_profiles
  ```
- [ ] **View:**
  ```sql
  select table_name from information_schema.views
  where table_schema = 'public';   -- expect: customer_reliability_scores
  ```
- [ ] **RPC:**
  ```sql
  select proname from pg_proc where proname in ('delete_own_account','handle_new_user');
  -- expect both
  ```
- [ ] **Signup trigger:**
  ```sql
  select tgname from pg_trigger where tgname = 'on_auth_user_created';  -- expect 1 row
  ```
- [ ] **RLS enabled on all 7 tables:**
  ```sql
  select relname, relrowsecurity from pg_class
  where relname in ('user_profiles','job_posts','job_applications',
                    'private_jobs','reviews','manual_income','disputes');
  -- relrowsecurity must be true for every row
  ```
  Also check Dashboard → Authentication → Policies shows policies for each table.

---

## Step 4 — Configure Auth (email/password only)

> Provider settings live in the dashboard, **not** in this repo. Do not edit
> `contexts/AuthContext.tsx` or `template/core/` — the client code is already correct.

1. [ ] Authentication → **Providers → Email** → **enabled**.
2. [ ] Decide **email confirmation** on/off:
   - The app's signup flow sets local user state immediately and expects to use a
     session shortly after. For the simplest launch, **disable email confirmation**
     (Authentication → Providers → Email → "Confirm email" off) so signup yields a
     usable session right away. Turn it on later if you add a verification UX.
3. [ ] Authentication → **URL Configuration**: set **Site URL** to your web origin.
       (Email/password doesn't need redirect URLs; this matters only when you add OAuth.)
4. [ ] **Google OAuth — DEFERRED.** Do **not** enable it for launch. The app's
       `signInWithGoogle()` is web-only as written (no native deep-link return
       handling) and is off the critical path. Revisit as a separate task.

Sanity check the signup→profile wiring (Step 2 trigger): creating a user must
auto-insert a `user_profiles` row. This is verified end-to-end in
`PRE_CUTOVER_TEST_CHECKLIST.md`.

---

## Step 5 — Deploy the `ai-quote` edge function

The function calls OpenAI server-side; the app invokes it via
`supabase.functions.invoke('ai-quote', …)`.

1. [ ] Set the secret (never an `EXPO_PUBLIC_` var):
   ```bash
   supabase secrets set OPENAI_API_KEY=sk-...
   ```
   (or Dashboard → Edge Functions → Secrets)
2. [ ] Deploy:
   ```bash
   supabase functions deploy ai-quote
   ```
3. [ ] Smoke test (replace URL/anon key with the **new** project's values; this does
   not touch the app's `.env`):
   ```bash
   curl -i -X POST 'https://<new-ref>.supabase.co/functions/v1/ai-quote' \
     -H "Authorization: Bearer <new-anon-key>" \
     -H "Content-Type: application/json" \
     -d '{"jobTitle":"Repaint hallway","jobDescription":"2 coats, 20m2"}'
   ```
   Expect HTTP 200 with a JSON `{ "data": { ... } }` body.

---

## Step 6 — Run pre-cutover verification

- [ ] Work through **`PRE_CUTOVER_TEST_CHECKLIST.md`** against the new project,
      using a throwaway `.env.local` or a temporary build so the live app stays on
      OnSpace. Do not proceed to cutover until every item passes.

---

## Step 7 — Cutover (NOT part of this runbook)

Deferred and intentionally out of scope here. When verification passes and you
explicitly approve, the cutover is: set `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY` to the new project, rebuild Expo, re-verify on the
live app. See `MIGRATION_CHECKLIST.md` Step 7.

---

## Rollback

The cutover is just two values in `.env` (`EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY`). Rolling back = restore the old OnSpace values
and rebuild. Nothing is destructive:

- This is a **fresh start** — no OnSpace data was migrated or deleted, and the
  new Supabase project never touches OnSpace. OnSpace stays fully intact.
- Migrations are idempotent; re-running them changes nothing.

### How reversible, by phase

| Phase | Reversible? | Notes |
|-------|-------------|-------|
| **Test phase (pre-cutover)** | Trivially | The app is still on OnSpace. Rollback is a no-op — just don't switch the env vars. Delete `.env.local` to drop the local pointer. |
| **Just after cutover, low traffic** | Easily | Flip the env back; little/no new data created on Supabase to lose. |
| **After sustained live traffic** | Switch still instant, but data diverges | Any signups/jobs/reviews created on Supabase during the live window live **only** on Supabase. Restoring OnSpace does not bring that data back — you'd export/reconcile it manually. |

### Rollback steps (after cutover)

1. In `.env`, restore the previous OnSpace values:
   - `EXPO_PUBLIC_SUPABASE_URL=<onspace url>`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY=<onspace key>`
2. Rebuild / restart Expo so the env is picked up:
   ```bash
   npx expo start -c
   ```
3. Verify the app is talking to OnSpace again (sign in, load jobs).

> Keep the old OnSpace `.env` values recorded before cutover so this is a paste,
> not a scramble.

### Safe-cutover practice

- Keep OnSpace running (read-only is fine) as a fallback for a short window after
  cutover.
- Watch Supabase logs (Auth, Postgres, Edge Functions) for the first hours.
- Only decommission OnSpace once you're confident and have reconciled any data
  created during the live window.
