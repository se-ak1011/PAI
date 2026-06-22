# Trustap — Research (job-payments escrow for PAI)

Deep-research synthesis (5 angles, cited). Date: 2026-06-22.
⚠️ Method caveat: Trustap's own domains hard-block automated fetching, so many
claims rest on search-snippet quotes of their pages + third-party sources
(notably Sharetribe's marketplace-payments academy). Treat exact figures as
indicative; verify live before committing. Regulatory points need a lawyer.

## TL;DR verdict
Trustap is a **legitimate escrow + Merchant-of-Record (MoR)** option that genuinely
offloads regulatory + chargeback burden — but **it does NOT escape the "sales call"
friction you wanted to avoid with Mangopay** (it's sales-gated too), and its
integration is a **hosted redirect / web plugin with no native mobile SDK**, which
is a UX downgrade inside an Expo/React Native app.

## What it is
- Irish company (Trustap Ltd, Cork, CRO 614918), founded ~2017; $5.5M Series A
  (TX Ventures, Jul 2024). Trustpilot ≈ 3.5/5 (~118 reviews). [crunchbase; trustpilot]
- "Escrow-style" transaction protection **built on top of Stripe** — Stripe is the
  actual payment processor/regulated entity. [trustap.com/terms; stripe newsroom]

## How the escrow flow works
- Buyer pays the **full amount up front** into the "Trustap Hold/Vault" — a
  **Stripe-held, safeguarded client-monies account**. [trustap.com/terms]
- Funds release to the seller after a **fulfilment/handover confirmation** + a
  **complaint period (default 24h)** elapses → auto-release. Partner platforms can
  configure the period. [zendesk help centre]
- Two models: **Online** (shipped goods, release on tracked delivery) and
  **Face-to-Face** (QR handover). Markets **services** + **milestones** (e.g. 50%
  kickoff / 50% sign-off) and partial release for partly-completed work. [docs; blog]
- ⚠️ Gap: no dedicated "service performed on-site" (tradesperson at a home)
  transaction type — you'd model it via the generic service/milestone constructs.

## Regulatory (the important bit for PAI)
- **Trustap itself does NOT appear to hold its own PI/EMI licence.** The regulated,
  fund-safeguarding entity is **Stripe** (Stripe Technology Europe Ltd / Central
  Bank of Ireland C187865 in the EU; Stripe Payments UK Ltd / FCA in the UK). [CBI/FCA registers]
- Trustap markets itself as **Merchant of Record** and states partners "don't have
  to become a regulated financial entity." Intended benefit: route funds through
  Trustap-as-MoR-on-Stripe so **PAI avoids money-transmitter / EMI / safeguarding**. [trustap.com/merchant-of-record]
- ⚠️ This is Trustap's marketing claim. Whether PAI *specifically* escapes
  authorisation depends on the exact flow and **must be confirmed by a payments
  lawyer + Trustap in writing.** Stripe's own docs note MoR allocation isn't automatic.
- ⚠️ Name-collision: "Trust Payments" (an FCA-authorised PI) is a DIFFERENT company.

## Onboarding — NOT self-serve ⚠️
- API keys are issued by a Trustap **"integration specialist"**; primary CTA is
  **"Get in touch" / "Contact us."** Managed/consultative onboarding like
  Mangopay/Adyen. You can read docs + use staging, but **need a human to go live.** [docs/intro/auth; contact-us]
- KYB required of the marketplace (specifics undocumented). Sellers complete KYC
  (deferrable until payout); buyers transact with minimal details. No public
  value-threshold table found.

## Pricing (region/channel-dependent — verify)
- Consumer buyer fee ≈ **3% + £0.40** (region-dependent; 4.4% US). [zendesk prices]
- Platform/marketplace pricing (per Sharetribe): cards from **~1.8% + €0.30** (incl.
  escrow); open banking 0.25–1.5%; optional managed tier ~€60–249/mo + ~1.2–1.4%.
- High-value discount: >£5k → 1.5% down to ~0.5%. Who pays = **configurable**
  (buyer by default; platform can reallocate/absorb). [trustap blog; docs/pricing]

## Coverage & methods
- **UK supported** (seller registration + payouts), **GBP** supported; buyers pay
  from 130+ countries. Methods: cards, Apple/Google Pay, open banking, some local. [zendesk country list]

## Integration — hosted redirect, no mobile SDK ⚠️
- Public REST API + OpenAPI + webhooks. BUT integration is a **web JS plugin +
  redirect to a Trustap-HOSTED payment page** — not an embeddable native card form.
- **No iOS / React Native / Expo SDK found.** Inside PAI you'd redirect to a Trustap
  webview/browser, not native in-app payment UI. [docs; github integration_demo]

## Disputes / chargebacks
- As **MoR, Trustap absorbs chargeback + dispute liability** — the central
  differentiator vs Stripe Connect (where the *platform* is liable). Trustap runs
  the dispute investigation; 24h complaint window. [merchant-of-record docs; stripe connect disputes]

## vs alternatives (for a UK services marketplace)
- **Stripe Connect (delayed transfers):** self-serve, native SDKs (RN/iOS),
  embeddable UI, huge ecosystem — BUT *you* carry chargeback liability, ~90-day hold
  cap, and must structure carefully to not be the MoR. 
- **Mangopay:** wallet/e-money licence, fine-grained ledger, EU regulatory — but
  sales-gated + pricier.
- **Trustap:** offloads chargeback + regulatory burden (MoR on Stripe), open-ended
  holds, services/milestones — BUT sales-gated (like Mangopay), hosted-redirect UX,
  no mobile SDK, ~3.5 Trustpilot, payout-speed complaints.

## Recommendation for PAI
1. If the priority is **avoiding sales calls + native UX** → Trustap does NOT solve
   that (it's sales-gated + redirect UX). Re-examine **Stripe Connect** first.
2. If the priority is **offloading chargeback + regulatory liability** → Trustap is a
   strong, purpose-built option and beats DIY Stripe Connect on that axis.
3. Either way: **get a payments lawyer** to confirm the regulatory boundary for your
   exact flow, and confirm the mobile/redirect UX with Trustap before committing.
