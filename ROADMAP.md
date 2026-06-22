# PAI — Roadmap

Working roadmap of decisions and upcoming work. Companion to:
- `PROJECT_STATUS.md` — current state / what's built vs stubbed.
- `PAYMENTS.md` — payments decision record (the "two rails").
- `POLISH.md` — "nice → premium" UX polish checklist (haptics, motion, skeletons, etc.).

> How to use: keep this updated as decisions are made. Each item notes **why**,
> the **work involved**, and any **open questions / caveats**. Nothing here is a
> commitment to order — it's a captured backlog.

## Status legend
- ✅ Done / shipped
- 🔜 Next up
- 🧊 Later / backlog
- ❓ Decision needed
- ⚠️ Caveat / risk

---

## ✅ Recently shipped
- iOS app building on **Expo SDK 54 / RN 0.81 / Xcode 26** → installable via TestFlight.
- **New Architecture** enabled (required by Reanimated 4; SDK 54 default).
- **Manual job entry** — "Skip AI — enter details manually" on New Job. AI is now
  optional, never forced (invoicing was already AI-free).
- **Auto-incrementing build number** (timestamp-based) — TestFlight uploads can no
  longer collide on version. Marketing version is bumped manually per release.
- **Settings shows the real app version** (from `expo-constants`, not hardcoded).
- **Contractor onboarding paywall (UI)** — final onboarding step presents the 14-day
  trial + £25/mo offer; CTA starts the trial. Real RevenueCat purchase wired later.
- **Polish:** removed fake stock-photo portfolios (own + public profile) → empty states.

---

## 🔜 Next up

### 1. Onboarding payment step (start free trial before entering app)
- **Why:** lower friction + higher conversion; it's a free trial anyway.
- **Work:** gate app access behind "Start free trial" during onboarding. With
  RevenueCat + Apple IAP (below), Apple already holds the card, so it's a one-tap
  sheet — no card entry. Apple permits hard paywalls as long as it's via IAP.
- **Depends on:** Subscriptions rail (RevenueCat) being live.

### 2. Work progress photos (optional, per job)
- **Why:** let tradespeople attach progress photos to a job.
- **Design steer:** in-app **"Add progress photo" → camera** on each job, optionally
  GPS-tagged at capture. (Avoid scanning the whole photo library by location —
  privacy-heavy.) `expo-camera` + `expo-location` are already installed.
- **Depends on:** **Supabase Storage** buckets + upload flow (currently stubbed).

### 3. AI quote — confirm live
- Confirm `ai-quote` Edge Function is deployed and `OPENAI_API_KEY` secret is set
  in Supabase, then test a quote end-to-end. (Supabase client connection already live.)

---

## 🧾 Receipt Vault + Claimable Expenses (Tax Pot)

A standout feature that deepens PAI's tax angle. **Reuses infra you already have.**

**Flow:**
1. Income lands on a job → PAI prompts *"Any expenses for this job?"*
2. Trader uploads receipts (materials, tools, PPE, parking, fuel, work clothes, subcontractors).
3. **AI reads the receipt** and suggests: category · amount · business/personal/mixed ·
   **confidence score** · *"ask your accountant"* when unsure.
4. Tax Pot then shows: estimated tax set-aside · **potential deductible expenses** ·
   **estimated taxable profit** (income − allowable expenses) · receipts needing review.

**How it maps onto what exists (low new-infra cost):**
- **AI:** new `ai-receipt` Edge Function mirroring `ai-quote`, using **OpenAI vision**
  (gpt-4o-mini accepts images) to extract vendor/amount/date/line items + suggest category.
- **Storage:** a private `receipts` bucket (same owner-scoped pattern as `job-photos`).
- **Data:** an `expenses` table (or extend the existing `private_jobs.receipts` field) —
  fields: job_id, amount, category, split (business/personal/mixed), confidence,
  image_path, status (suggested/confirmed/needs-review).
- **Tax Pot:** extend the existing set-aside math → taxable profit = income − confirmed
  deductibles; add a "needs review" queue.

**Considerations / caveats:**
- ⚠️ **Not tax advice.** Show a clear disclaimer; the "ask your accountant" flag and
  confidence score are the trust mechanism. AI suggestions are drafts the trader confirms.
- ⚠️ **UK allowable-expense nuance** (e.g. everyday clothing generally *not* deductible,
  only protective/uniform; mileage vs fuel methods) — encode rules carefully, conservatively.
- Depends on: Storage (same as photos) + OpenAI billing (same key) + a confirm/edit UX.
- Great "Ooo" moment: snap a receipt → watch PAI fill in the fields. Pairs with `POLISH.md`.

---

## 💳 Payments rework (the big one — see also `PAYMENTS.md`)

Two separate rails:

### Rail A — Subscriptions → **RevenueCat + Apple/Google IAP**
- **Decision:** move subscriptions OFF Stripe to RevenueCat + in-app purchase.
- **Why:** Apple *requires* digital subscriptions to go through IAP; Stripe would be
  rejected. RevenueCat is the standard cross-platform wrapper.
- **Status:** ❓ not started. This is the cleaner/required path — do it.

### Rail B — Job payments → **true third-party escrow**
- **Decision:** move OFF the current Stripe Connect setup. Stripe Connect (as used)
  isn't true escrow — funds can flow through us, which risks **money-transmitter /
  e-money / FCA safeguarding** obligations (registration, audits, capital). Hard no.
- **Goal:** a third party that **charges the card, holds the money, releases on
  completion** — where *they* (not us) carry the regulatory burden.
- **⚠️ Reality:** genuine escrow *is* regulated, so providers who hold funds for you
  almost always require KYB onboarding (sometimes a sales call) — that's the point.
- **Options (self-serve → heavy):**
  - **Re-examine Stripe Connect first** — structured correctly (Stripe as merchant of
    record, *destination charges* + *delayed transfer* until completion), Stripe is the
    regulated party, not us. Most self-serve. May solve it without a sales call.
    Confirm exactly how long funds must be held before ruling out.
  - **Mangopay / Lemonway** — true marketplace escrow, built for this, but onboarding /
    sales call (cognitive-load cost — noted).
  - ❌ Paddle / Lemon Squeezy — merchant-of-record for *digital goods*, NOT
    person-to-person job payments. Not a fit for Rail B.
- **Customer payment up-front (decision):** capture the customer's payment method
  during **customer onboarding** (not at quote-acceptance), so they can post / request
  quotes and never get blocked at the accept moment. ⚠️ Can't build until the provider
  is chosen — the card-capture UI *is* the provider's SDK, and we must not handle raw
  card data ourselves. Build the customer onboarding step + acceptance flow together
  with the escrow integration.
- **❓ Open:** pick the provider after confirming the Stripe Connect hold limits.
- **⚠️ Legal:** UK payment/safeguarding rules warrant a short paid legal sanity-check
  before launch. Cheaper than guessing wrong.

---

## 🔐 Auth providers (Google + Apple)

- **State:** Google is half-built (code incomplete for native + provider not configured
  in Supabase). Apple is a stub ("not supported") and `expo-apple-authentication` isn't
  installed (likely removed earlier to unblock builds).
- **⚠️ App Store Guideline 4.8:** if you offer Google sign-in, you **must** also offer
  Sign in with Apple, or Apple rejects the app. So: keep Google → Apple is mandatory;
  or drop Google → email-only is fine.
- **Work:**
  - **Google:** switch to native ID-token flow + Google Cloud OAuth client IDs + enable
    Google provider in Supabase.
  - **Apple:** add `expo-apple-authentication` + implement + entitlement (rebuild) +
    Apple Developer Service ID/key + enable Apple provider in Supabase.
- **Not a blocker for testing now** — email/password works. This is a pre-public-launch item.
- **Secrets:** client IDs are public-safe; Google client *secret* + Apple private key go
  straight into Supabase, never into chat/repo.

---

## 🧊 Backend "make it live" (from `PROJECT_STATUS.md`)
- **Supabase Storage** — avatar/portfolio/progress-photo uploads (currently stubbed).
- **Push notifications** — registration flow not built; placeholder only.
- **Public contractor profile** — QR links to hardcoded `https://pai.app/contractor/…`;
  needs the web build deployed to that domain to resolve.
- **Data end-to-end** — jobs / income / earnings populate once flows are exercised
  against the live Supabase project.
- **Admin moderation** — uses anon client; needs a production-safe admin mechanism.

---

## ❓ Open decisions
- Rail B escrow provider (after Stripe Connect hold-limit check).
- Whether to keep Google sign-in (→ commits you to Apple sign-in too).
- Timing of the onboarding paywall vs. letting people explore first.
