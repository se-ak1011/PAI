# Backend Architecture

This document describes PAI's backend: where it runs today, the standalone
Supabase target reconstructed from the codebase, and the plan to move between
them. The step-by-step cutover lives in [`MIGRATION_CHECKLIST.md`](./MIGRATION_CHECKLIST.md).

> **Current status:** the live backend is **unchanged**. `EXPO_PUBLIC_SUPABASE_URL`
> still points at the OnSpace instance. The work captured here is schema +
> documentation only — no backend has been switched, no functions deployed, no
> auth config touched.

---

## 1. Current backend — OnSpace

PAI runs against a single **OnSpace-hosted, Supabase-compatible** backend. It is
**not** a native `*.supabase.co` project.

| Aspect | Detail |
|--------|--------|
| Endpoint | `https://<project>.backend.onspace.ai` (set via `EXPO_PUBLIC_SUPABASE_URL`) |
| Anon key | `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| Client SDK | `@supabase/supabase-js` (`^2.50.0`) — the only backend SDK in the app |
| Client creation | Once, in `template/core/client.ts`; consumed app-wide via `getSupabaseClient()` from `@/template`. Never call `createClient()` elsewhere. |
| Auth | Supabase Auth — email/password + Google OAuth (PKCE). Session persisted to AsyncStorage (native) / localStorage (web). |
| Auth logic | `contexts/AuthContext.tsx` (the template's bundled auth module was removed as dead code). |
| Edge functions | `supabase/functions/ai-quote/index.ts` — runs on the OnSpace instance, calls OpenAI server-side via `OPENAI_API_KEY`. The repo copy is source only; it must be redeployed on the target to take effect. |
| Schema & RLS | Historically managed **on the OnSpace instance** — there were no migrations in the repo. They are now reconstructed under `supabase/migrations/` (see §3). |
| Config scaffold | `template/core/` is the OnSpace SDK scaffold. Declared modules: `auth` enabled (profile table `user_profiles`), **`payments: false`, `storage: false`**. |

### Not actually wired up

- **Stripe** — there is a dependency (`@stripe/stripe-react-native`), fee math
  in `constants/config.ts`, UI copy, and a `stripe_customer_id` column, but
  **no Stripe integration code and no payment server**. The checkout "Pay" flow
  is a placeholder alert. Payments are out of scope for the backend move.
- **Storage** — `storage: false`; there are zero `supabase.storage` calls.
  `avatar_url`, `photo_url`, `portfolio_images`, and `receipts` are plain
  URL/text. No buckets are required.

---

## 2. Reconstructed Supabase target

The target is a **standalone Supabase project** whose schema is fully described
by the migrations in `supabase/migrations/`. These were derived by auditing every
`.from()`, `.select()`, `.insert()`, `.update()`, `.delete()`, `.rpc()`,
`.functions.invoke()`, relationship embed, and `auth.*` call in the app.

### Tables

| Table | Purpose | Key code references |
|-------|---------|---------------------|
| `user_profiles` | One row per auth user; profile, trade info, subscription/trial, marketplace prefs | `AuthContext`, `marketplace.tsx`, `contractor-profile.tsx`, `TaxPotContext` |
| `job_posts` | Public marketplace jobs posted by customers | `JobsContext`, `marketplace-job.tsx`, `job-detail.tsx` |
| `job_applications` | Contractor quotes against a post; unique per `(job_post_id, contractor_id)` | `marketplace-job.tsx` |
| `private_jobs` | Contractor's private job ledger; feeds invoices + Tax Pot | `JobsContext`, `marketplace-job.tsx`, `TaxPotContext` |
| `reviews` | Two-way structured reviews (`mode`); unique per `(author, subject, job_post, mode)` | `CustomerReviewModal.tsx`, `profile.tsx`, `contractor-profile.tsx`, `admin-disputes.tsx` |
| `manual_income` | Manually-entered income for the Tax Pot | `TaxPotContext` |
| `disputes` | Filed against a job; resolved by admins | `admin-disputes.tsx` |

### Other objects

| Object | Kind | Reference |
|--------|------|-----------|
| `customer_reliability_scores` | **view** — aggregates published `contractor_to_customer` reviews per customer | `hooks/useReliability.tsx` |
| `handle_new_user()` + `on_auth_user_created` | **trigger** — auto-creates a `user_profiles` row on signup (the app only ever `UPDATE`s, never inserts, so the row must pre-exist) | `AuthContext` |
| `delete_own_account()` | **RPC** (SECURITY DEFINER) — deletes the caller's auth user; cascades to their data | `AuthContext.deleteAccount()` |

### PostgREST relationship embeds relied on by the app

- `job_posts` → `user_profiles!job_posts_client_id_fkey(username, avatar_url)`
- `job_posts` → `job_applications(id)`
- `job_applications` → `contractor:contractor_id(username, city, trades, hourly_rate_from)`
- `reviews` → `author:author_id(username)`, `subject:subject_id(username)`
- `disputes` → `contractor:contractor_id(username)`, `customer:customer_id(username)`, `job_post:job_post_id(title)`

All are backed by the foreign keys defined in the migrations.

### Row Level Security

RLS is enabled on every table with policies scoped to `auth.uid()`:

- **Public read:** `user_profiles`, `job_posts` (marketplace + public `/contractor/{id}` links).
- **Owner-scoped:** `private_jobs`, `manual_income`, and writes to `user_profiles`.
- **Party-scoped:** `job_applications` (contractor + post owner), `disputes` (the two parties).
- **Reviews:** published rows readable by all; an author reads/writes only their own
  (so `private_note` is never exposed publicly).
- **Admin-only writes are intentionally NOT granted to authenticated users.**
  Resolving disputes and removing/restoring reviews (in `app/admin-disputes.tsx`)
  must run with the **service role**. There is no admin role/claim in the
  codebase, and these actions are admin-only by design — regular users must not
  have access. Add an `is_admin` mechanism later if these screens should operate
  from the client.

---

## 3. Migration files

Applied in lexical order:

| Order | File | Contents |
|-------|------|----------|
| 1 | `supabase/migrations/20260613000001_initial_schema.sql` | Tables, constraints, indexes, `handle_new_user` trigger |
| 2 | `supabase/migrations/20260613000002_customer_reliability_scores.sql` | `customer_reliability_scores` view |
| 3 | `supabase/migrations/20260613000003_delete_own_account.sql` | `delete_own_account()` RPC |
| 4 | `supabase/migrations/20260613000004_rls_policies.sql` | RLS enablement + policies |

They are additive and idempotent (`create ... if not exists`, `create or replace`,
`drop policy if exists`), so they apply cleanly to a fresh project or layer onto
an existing one. See `supabase/migrations/README.md` for the full query-to-object
trace.

---

## 4. Migration plan (high level)

The detailed, copy-pasteable runbook is in
[`MIGRATION_CHECKLIST.md`](./MIGRATION_CHECKLIST.md). In summary:

1. **Provision** a standalone Supabase project.
2. **Apply** the four migrations (Supabase CLI or SQL editor, in order).
3. **Configure auth providers** (email/password + Google OAuth, redirect URLs).
4. **Deploy** the `ai-quote` edge function and set `OPENAI_API_KEY`.
5. **Migrate data** from OnSpace if existing rows must carry over.
6. **Repoint** `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` — the
   single cutover step. **Deferred — not done yet.**
7. **Verify** end-to-end, then decommission OnSpace.

### Out of scope for the backend move

- **Stripe payments** — stubbed today; needs a real implementation regardless of
  which backend is used.
- **Storage buckets** — none required; image fields stay as URLs.
