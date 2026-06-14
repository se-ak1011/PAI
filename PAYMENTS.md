# Payments architecture

> Decision record. Captures **why** PAI uses two separate payment rails and the
> seams to build when each is implemented. Nothing here is wired up yet —
> subscriptions and marketplace payments are both stubbed in the app today.

## TL;DR — two rails, by design

| Concern | Rail | Why |
| --- | --- | --- |
| **Contractor subscription** (unlock app features: AI quoting, Tax Pot, etc.) | **Apple IAP / Google Play Billing, via RevenueCat** | Unlocking in-app features is a *digital* purchase. Apple Guideline **3.1.1** mandates StoreKit IAP for this. Stripe-in-app for a subscription **gets rejected in review.** |
| **Customer → contractor payment** (paying for a real-world trade job) | **Stripe (Stripe Connect)** | Payment for a *physical service performed off-app*. Apple Guideline **3.1.3(e) / 3.1.5** ("goods & services outside the app" — Uber, TaskRabbit, Thumbtack) allows external payment here. IAP is **not required and not permitted** for it. |

These are **not interchangeable**. Do not try to put the subscription on Stripe,
and do not try to put marketplace payments through IAP.

## Apple App Store rules that drive this

- **3.1.1 (In-App Purchase):** if the app unlocks features/functionality, it
  **must** use IAP. The contractor subscription unlocks digital tools → IAP.
- **3.1.3(e) / 3.1.5 (goods & services outside the app):** physical goods or
  real-world services consumed outside the app use other payment methods (Stripe).
  The trade job is performed in the real world → Stripe.
- **Anti-steering:** inside the iOS app, **do not** show external "subscribe on
  the web" links or pricing for the *subscription*. The marketplace Stripe
  checkout (for jobs) can be shown normally.

## Rail 1 — Subscription (RevenueCat + StoreKit)

- **Why RevenueCat:** SDK layer on top of Apple IAP (and Google Play Billing
  later). Handles the 14-day trial, renewals, restores, receipts, and
  entitlements. Free under ~$2.5k/mo tracked revenue, then 1%.
- **Source of truth for entitlement:** StoreKit/RevenueCat — **not** the
  database. The app should gate features on the RevenueCat *entitlement*, not on
  a column it sets itself.
- **Price lives in App Store Connect / RevenueCat**, not in code.
  > Note: `constants/config.ts` currently hardcodes £25/mo in copy; the real
  > price is configured in App Store Connect when IAP is set up.

### Sync seam: RevenueCat → Supabase

Keep the DB in sync so server-side logic and the UI can read subscription state:

1. Use the **Supabase user id as the RevenueCat App User ID** (so the two line up).
2. Configure a **RevenueCat webhook → Supabase Edge Function**.
3. The function maps RevenueCat events to `public.user_profiles`:
   - `INITIAL_PURCHASE` / `RENEWAL` / `UNCANCELLATION` → `subscription_status = 'active'`
   - trial events → `subscription_status = 'free_trial'`, set `trial_started_at` / `trial_ends_at`
   - `CANCELLATION` (still entitled until expiry) → keep `'active'` until expiry
   - `EXPIRATION` → `'expired'` (or `'past_due'` on billing issue)

### Existing schema (forward-compatible — no migration needed now)

`public.user_profiles` already has: `subscription_status`, `trial_started_at`,
`trial_ends_at`. When RevenueCat is wired:

- `stripe_customer_id` is **irrelevant to subscriptions** — leave it for the
  marketplace rail or drop it later.
- Optionally add `revenuecat_app_user_id` (or just reuse the Supabase user id).

### App seam today

`contexts/AuthContext.tsx` exposes `isSubscriptionActive()` /
`isContractorTrialActive()` reading `subscription_status`. When RevenueCat lands,
this becomes "read the RevenueCat entitlement, fall back to the synced column."

## Rail 2 — Marketplace payment (Stripe Connect)

- **Stripe Connect**, contractor = connected account.
- Customer pays the **quote + transparent processing fee** (fee math already in
  `constants/config.ts` → `STRIPE_FEES`).
- Contractor receives the **full quote**; **PAI takes no commission** (platform
  principle) — it only passes through Stripe's processing fee to the customer.
- `user_profiles.stripe_customer_id` and the "Connect payouts (Stripe)" CTA on
  the home screen are the placeholders for this rail.

## Status

- ⛔ Neither rail is implemented. Subscription = `subscription_status` field +
  helpers; marketplace = "Stripe payment will be processed" placeholder alert.
- ✅ Schema is forward-compatible with both — no changes required to start either.
