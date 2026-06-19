# PROJECT_STATUS.md

This file is the single source of truth for the current state of PAI. Future audits and significant code changes must update this file before changing code. Unknown means the repository did not contain enough evidence to verify the item.

## Project Overview

| Field | Current State |
| --- | --- |
| Project name | PAI (`pai-app`) |
| Current version | `1.0.0` in `package.json`, `app.json`, and `app.config.js` |
| Current branch | `work` |
| Last audit date | 2026-06-19 (app-loading re-audit) |
| Current backend | Supabase via `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`; schema source in `supabase/migrations/`; one Edge Function source: `supabase/functions/ai-quote/index.ts` |
| Current frontend | Expo SDK 53 / React Native 0.79.3 / React 19 app using Expo Router |
| Build status | Web export and TypeScript check verified on 2026-06-19. Expo public config loads. Native/EAS builds not verified in this audit. |
| Production readiness percentage | 35% estimate: core marketplace/job/profile flows are implemented, but payments, native production verification, push, storage uploads, app-store compliance, and backend deployment verification remain incomplete. |

## Current Status Legend

- 🟢 Working: implemented and verified in this audit or by a passing automated check.
- 🟡 Partially working: implemented but not fully verified or incomplete.
- 🟠 Stubbed / placeholder: visible seam or placeholder behavior exists, but no real implementation.
- 🔴 Broken: verified failure.
- ⚪ Not started: no meaningful implementation found.

## Current Status Summary

| Area | Status | Evidence / Notes |
| --- | --- | --- |
| Web build | 🟢 Working | `npm run build` completed and exported 20 static routes to `dist`. |
| Lint | 🟡 Partially working | `npm run lint` exits 0 but reports 29 warnings. |
| Native iOS/Android builds | ⚪ Not started in audit | EAS profiles exist, but no native build was run. |
| Supabase client | 🟡 Partially working | Central client exists and web build could instantiate it with local env vars; deployed backend state not verified. |
| Authentication | 🟡 Partially working | Email/password and Google OAuth code exists; live auth flow was not manually verified. |
| Payments | 🟠 Stubbed / placeholder | Stripe and RevenueCat rails documented but not implemented. |
| AI quote generation | 🟡 Partially working | Client invokes Supabase Edge Function; deployment and `OPENAI_API_KEY` secret unknown. |
| Storage uploads | 🟠 Stubbed / placeholder | Storage disabled; avatar/portfolio upload buttons show coming-soon alerts. |
| Push notifications | 🟠 Stubbed / placeholder | Dependency installed and profile settings placeholder exists; no push registration flow found. |

## Core Features

### Authentication

- Status: 🟡 Partially working
- Description: Supabase Auth is implemented for session loading, email/password sign-in/sign-up, Google OAuth, sign-out, account deletion via RPC, and profile updates.
- Files involved: `contexts/AuthContext.tsx`, `hooks/useAuth.tsx`, `template/core/client.ts`, `app/auth.tsx`, `app/onboarding.tsx`, `supabase/migrations/20260613000003_delete_own_account.sql`.
- Dependencies: `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `expo-auth-session`, `expo-web-browser`, Supabase Auth providers.
- Known issues: OAuth provider configuration and redirect URLs are not verified; live sign-in/sign-up was not manually tested; user profile row depends on the `handle_new_user` trigger being deployed.
- Next action: Verify email/password and Google OAuth against the configured Supabase project on web and a development build.

### User Profiles

- Status: 🟡 Partially working
- Description: User profile display/edit fields exist for username, role, trade, city, tax rate, profile URLs, portfolio URL fields, and review summaries.
- Files involved: `contexts/AuthContext.tsx`, `app/(tabs)/profile.tsx`, `app/contractor-profile.tsx`, `app/contractor/[id].tsx`, `supabase/migrations/20260613000001_initial_schema.sql`.
- Dependencies: Supabase `user_profiles`, `reviews`, QR/share libraries.
- Known issues: Avatar and portfolio uploads are not implemented; fields are URLs/text only; public profile domain is hardcoded to `https://pai.app`.
- Next action: Decide whether to keep URL-only images or implement Supabase Storage buckets and upload flows.

### Trader Onboarding

- Status: 🟡 Partially working
- Description: Onboarding and role/profile update paths exist for contractors/traders.
- Files involved: `app/onboarding.tsx`, `contexts/AuthContext.tsx`, `constants/config.ts`.
- Dependencies: Supabase Auth, `user_profiles` table.
- Known issues: End-to-end onboarding was not manually verified; subscription gating currently relies on database state, not RevenueCat entitlement.
- Next action: Run a fresh contractor signup and onboarding QA pass.

### Customer Onboarding

- Status: 🟡 Partially working
- Description: Customer role and marketplace job posting flows are present.
- Files involved: `app/onboarding.tsx`, `components/feature/PostJobModal.tsx`, `contexts/JobsContext.tsx`, `app/(tabs)/marketplace.tsx`.
- Dependencies: Supabase Auth, `user_profiles`, `job_posts`.
- Known issues: End-to-end customer onboarding was not manually verified.
- Next action: Run a fresh customer signup and job-posting QA pass.

### Jobs

- Status: 🟡 Partially working
- Description: Private contractor jobs and public marketplace job posts are implemented with create, update, delete, lifecycle status, and accepted marketplace conversion into private jobs.
- Files involved: `contexts/JobsContext.tsx`, `app/(tabs)/jobs.tsx`, `components/feature/CreateJobModal.tsx`, `components/feature/JobCard.tsx`, `app/job-detail.tsx`, `app/marketplace-job.tsx`, `supabase/migrations/20260613000001_initial_schema.sql`.
- Dependencies: Supabase `private_jobs`, `job_posts`, `job_applications`.
- Known issues: Native and live backend flows were not manually verified; no realtime updates found.
- Next action: Run create/update/delete/acceptance tests against a seeded Supabase project.

### Quotes

- Status: 🟡 Partially working
- Description: Marketplace applications act as quotes; an AI quote service calls a Supabase Edge Function.
- Files involved: `app/marketplace-job.tsx`, `services/aiService.ts`, `supabase/functions/ai-quote/index.ts`, `constants/config.ts`.
- Dependencies: Supabase `job_applications`, deployed `ai-quote` Edge Function, `OPENAI_API_KEY` secret.
- Known issues: Edge Function deployment and OpenAI secret are unknown; AI output not verified in this audit.
- Next action: Deploy/verify `ai-quote` and add a minimal smoke test or QA checklist.

### Invoices

- Status: 🟡 Partially working
- Description: Invoice screen and create-invoice modal exist; job status includes invoiced and paid states.
- Files involved: `app/invoice.tsx`, `components/feature/CreateInvoiceModal.tsx`, `contexts/JobsContext.tsx`, `constants/config.ts`.
- Dependencies: Supabase `private_jobs`, local PDF/print/share dependencies if used by screen.
- Known issues: Payment collection is placeholder; invoice generation/export was not manually verified.
- Next action: Verify invoice creation/export on web and native.

### Messaging

- Status: ⚪ Not started
- Description: No dedicated messaging tables or chat UI were found in the audited app source.
- Files involved: Unknown.
- Dependencies: Unknown.
- Known issues: No implementation found.
- Next action: Do not build until core production blockers are resolved unless messaging is required for launch.

### Reviews

- Status: 🟡 Partially working
- Description: Structured reviews are implemented, including contractor-to-customer reliability scores and admin moderation UI.
- Files involved: `components/feature/CustomerReviewModal.tsx`, `app/(tabs)/profile.tsx`, `app/contractor-profile.tsx`, `app/admin-disputes.tsx`, `hooks/useReliability.tsx`, `supabase/migrations/20260613000002_customer_reliability_scores.sql`.
- Dependencies: Supabase `reviews`, `customer_reliability_scores` view, `disputes` for admin workflows.
- Known issues: Admin moderation requires service-role/admin backend capability, but the client uses the anon client; production-safe admin mechanism is missing.
- Next action: Move admin moderation to a secure server/Edge Function with authorization.

### Notifications

- Status: 🟠 Stubbed / placeholder
- Description: Notification settings and notification icon alerts exist; dependency is installed.
- Files involved: `app/(tabs)/profile.tsx`, `package.json`, `app.json`.
- Dependencies: `expo-notifications`, platform push credentials.
- Known issues: No push token registration, permission request, backend storage, or notification sending flow found.
- Next action: Implement push registration and backend notification model if required for launch.

### Calendar

- Status: 🟡 Partially working
- Description: In-app availability calendar UI exists in profile; native calendar dependency and iOS permission text exist.
- Files involved: `app/(tabs)/profile.tsx`, `app.json`, `package.json`.
- Dependencies: `react-native-calendars`, `expo-calendar`.
- Known issues: No verified native calendar integration found; availability appears stored on profile, not synced to OS calendar.
- Next action: Clarify whether OS calendar integration is required; otherwise remove unused native calendar permission/dependency.

### AI

- Status: 🟡 Partially working
- Description: AI quote generation has a client service and Supabase Edge Function source.
- Files involved: `services/aiService.ts`, `supabase/functions/ai-quote/index.ts`.
- Dependencies: Supabase Edge Functions, `OPENAI_API_KEY` secret.
- Known issues: Deployment status and secret configuration are unknown.
- Next action: Deploy and smoke-test Edge Function in the target Supabase project.

### Stripe

- Status: 🟠 Stubbed / placeholder
- Description: Fee math, copy, `stripe_customer_id`, and marketplace payment intent are documented, but no Stripe SDK dependency or payment server implementation is present in `package.json`.
- Files involved: `constants/config.ts`, `PAYMENTS.md`, `BACKEND.md`, `app/marketplace-job.tsx`, `supabase/migrations/20260613000001_initial_schema.sql`.
- Dependencies: Stripe Connect, webhook receiver, connected accounts, server-side payment intent creation.
- Known issues: Marketplace pay flow is a placeholder alert; no webhooks or Connect onboarding.
- Next action: Build server-side Stripe Connect payment flow and webhook reconciliation.

### RevenueCat

- Status: ⚪ Not started
- Description: Subscription architecture is documented, but no RevenueCat SDK integration was found.
- Files involved: `PAYMENTS.md`, `constants/config.ts`, `contexts/AuthContext.tsx`.
- Dependencies: RevenueCat project, Apple IAP, Google Play Billing, RevenueCat webhooks.
- Known issues: Contractor subscription is not production-ready and currently relies on Supabase profile fields.
- Next action: Add RevenueCat SDK, configure entitlements/products, and sync webhooks to Supabase.

### Settings

- Status: 🟠 Stubbed / placeholder
- Description: Profile/settings row includes placeholders for notifications and profile/photo management.
- Files involved: `app/(tabs)/profile.tsx`.
- Dependencies: Depends on setting.
- Known issues: Several settings show alerts instead of real screens.
- Next action: Convert launch-critical settings to functional screens; remove non-critical placeholders.

### Documents

- Status: ⚪ Not started
- Description: Document picker dependency is installed, but no app source usage was found.
- Files involved: `package.json`.
- Dependencies: `expo-document-picker`, storage backend if uploads are required.
- Known issues: No document workflow found.
- Next action: Remove dependency if not launch-critical, or implement document upload with storage.

### Search

- Status: 🟡 Partially working
- Description: Marketplace/profile discovery screens include filters/search-like behavior.
- Files involved: `app/(tabs)/marketplace.tsx`, `components/feature/MarketplaceCard.tsx`.
- Dependencies: Supabase `user_profiles`, `job_posts`.
- Known issues: Full-text search/indexing not verified; no dedicated search backend found.
- Next action: Verify filter behavior with realistic data and add indexes if needed.

### Maps

- Status: ⚪ Not started
- Description: City/postcode text fields exist; no map SDK usage found.
- Files involved: `app/(tabs)/profile.tsx`, `app/contractor-profile.tsx`.
- Dependencies: Unknown.
- Known issues: No map rendering, geocoding, or distance search found.
- Next action: Do not add maps unless required for launch; otherwise keep location text-only.

### Tax Pot

- Status: 🟡 Partially working
- Description: Tax pot tracks manual income and paid private jobs against configurable tax rates.
- Files involved: `contexts/TaxPotContext.tsx`, `hooks/useTaxPot.tsx`, `app/(tabs)/taxpot.tsx`, `components/feature/AddIncomeModal.tsx`, `supabase/migrations/20260613000001_initial_schema.sql`.
- Dependencies: Supabase `manual_income`, `private_jobs`, `user_profiles.tax_rate`.
- Known issues: Tax logic not legally/accounting verified; no export/report verification.
- Next action: Verify calculations and add disclaimers/QA tests before production.

### Business Profiles

- Status: 🟡 Partially working
- Description: Contractor public profiles and business profile fields are implemented.
- Files involved: `app/contractor-profile.tsx`, `app/contractor/[id].tsx`, `app/(tabs)/profile.tsx`, `constants/config.ts`.
- Dependencies: Supabase `user_profiles`, `reviews`.
- Known issues: Share domain is hardcoded; image uploads are not implemented.
- Next action: Verify production domain routing and public profile SEO/static export behavior.

## Backend Audit

### Supabase

- Status: 🟡 Partially working.
- Client: one shared Supabase client in `template/core/client.ts`.
- Config: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are read from environment or `app.config.js` extras.
- Verified this audit: web export instantiated the client using local `.env` values.
- Not verified: target project migrations applied, auth providers configured, Edge Function deployed, secrets set, or production data state.

### Database

- Status: 🟡 Partially working.
- Migration files found:
  - `supabase/migrations/20260613000001_initial_schema.sql`
  - `supabase/migrations/20260613000002_customer_reliability_scores.sql`
  - `supabase/migrations/20260613000003_delete_own_account.sql`
  - `supabase/migrations/20260613000004_rls_policies.sql`
- Verification scripts found: `supabase/verify_schema.sql`, `supabase/pre_cutover_test.sql`, `supabase/apply_all_migrations.sql`.
- Not verified: SQL was not applied to a live database during this audit.

### Authentication

- Status: 🟡 Partially working.
- Implemented: email/password, sign-up metadata, Google OAuth, session persistence, sign-out, delete-account RPC.
- Configured: local env vars exist; OAuth provider settings unknown.
- Production ready: No.

### Storage

- Status: 🟠 Stubbed / placeholder.
- Supabase Storage calls: none found in active app source.
- Storage config: `storage: false` in template config.
- Production ready: No if media/document uploads are required.

### Edge Functions

- Status: 🟡 Partially working.
- Implemented source: `supabase/functions/ai-quote/index.ts`.
- Dependencies/secrets: `OPENAI_API_KEY` required.
- Deployment: Unknown.

### Policies (RLS)

- Status: 🟡 Partially working.
- RLS policies are defined in `supabase/migrations/20260613000004_rls_policies.sql`.
- Not verified against live Supabase in this audit.
- Known risk: admin dispute/review moderation needs service-role or secure admin authorization outside the client.

### Environment Variables

- Status: 🟡 Partially working.
- `.env` and `.env.example` exist.
- App uses: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Edge Function uses: `OPENAI_API_KEY`.
- Additional local var observed in build output: `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION`.
- Missing for production features: Stripe keys/webhook secrets, RevenueCat API/webhook credentials, push credentials, analytics/crash reporting keys.

### Secrets

- Status: 🟡 Partially working.
- Local `.env` exists and contains public Supabase vars; secrets are not audited in detail here to avoid exposing sensitive values.
- Unknown: EAS environment variables and Supabase Edge Function secrets.

### Tables

Expected tables from migrations and active app calls:

- `user_profiles`
- `job_posts`
- `job_applications`
- `private_jobs`
- `reviews`
- `manual_income`
- `disputes`

### Views

- `customer_reliability_scores`

### Triggers

- `on_auth_user_created` trigger on `auth.users`, calling `handle_new_user()`.

### Functions / RPC

- `handle_new_user()`
- `delete_own_account()`
- Supabase Edge Function: `ai-quote`

### Realtime

- Status: ⚪ Not started.
- No Supabase Realtime subscriptions were found in the active app source.

### Missing Backend Dependencies

- Stripe payment server / Edge Functions.
- Stripe webhook receiver and webhook secret.
- Stripe Connect account onboarding and account-id storage.
- RevenueCat SDK and webhook receiver.
- Apple/Google subscription products and entitlements.
- Push token storage and notification sending backend.
- Supabase Storage buckets and policies if uploads become required.
- Secure admin authorization/service-role backend for dispute/review moderation.

### Legacy Backend References / Inactive Backend Code

- `OnSpace` / old scheme: `scheme` is still `onspaceapp` in `app.json` and `app.config.js`; this is a legacy naming concern.
- Old URL / hardcoded URL: `PUBLIC_WEB_BASE_URL` is `https://pai.app`; verify before production.
- Deprecated APIs: no specific deprecated app API usage verified, but lockfile contains deprecated transitive package notices.
- Unused services: `template/auth/supabase/*` and `template/auth/mock/*` remain in the repo but active auth logic uses `contexts/AuthContext.tsx`.
- Legacy auth: template auth modules appear inactive; app uses custom `contexts/AuthContext.tsx`.
- Inactive backend code: template auth service modules contain Supabase auth logic but were not found in active imports.

## Payments

| Payment Area | Implemented | Configured | Production ready | Still mocked / stubbed | Current Status |
| --- | --- | --- | --- | --- | --- |
| Stripe | Partial fee math/copy only | No | No | Yes | 🟠 Placeholder alert and docs only. |
| RevenueCat | No | No | No | Yes | ⚪ Architecture documented, SDK absent. |
| Apple IAP | No | Unknown | No | Yes | ⚪ Required for contractor subscription before iOS production. |
| Google Play Billing | No | Unknown | No | Yes | ⚪ Required for Android subscription before production. |
| Subscriptions | Partial DB fields/helpers | No RevenueCat/IAP | No | Yes | 🟠 Reads `subscription_status`; entitlement source of truth missing. |
| Marketplace payments | No | No | No | Yes | 🟠 Stripe Connect not implemented. |
| Connected accounts | No | No | No | Yes | ⚪ No Connect onboarding/account storage flow found. |
| Webhooks | No | No | No | Yes | ⚪ Stripe and RevenueCat webhooks missing. |
| Products | No | Unknown | No | Yes | ⚪ App Store / Play / RevenueCat products unknown. |
| Entitlements | No | Unknown | No | Yes | ⚪ RevenueCat entitlement missing. |

## Native Features

| Feature | Status | Permission configured | iOS | Android | Known issues |
| --- | --- | --- | --- | --- | --- |
| Camera | 🟠 Stubbed / placeholder | iOS camera/microphone strings exist | Permission text exists | No explicit Android permissions reviewed | No active camera flow found. |
| Photos | 🟠 Stubbed / placeholder | iOS photo strings exist | Permission text exists | No explicit Android permissions reviewed | Avatar/portfolio upload buttons are placeholders. |
| Documents | ⚪ Not started | Not found | Dependency installed | Dependency installed | No `expo-document-picker` usage found. |
| Notifications | 🟠 Stubbed / placeholder | Not explicitly configured in app config | Dependency installed | Dependency installed | No push registration or credentials verified. |
| Calendar | 🟡 Partially working | iOS calendar/reminders strings exist | In-app availability UI exists | Dependency installed | OS calendar integration not verified. |
| Location | 🟠 Stubbed / placeholder | iOS location string exists | Text location fields | Text location fields | No `expo-location` usage found. |
| Push notifications | ⚪ Not started | Unknown | Unknown | Unknown | No backend or token registration found. |
| Permissions | 🟡 Partially working | Several iOS usage descriptions exist | Broad set configured | Android permission needs unknown | Some permissions may be unnecessary for current app behavior. |
| Deep links | 🟡 Partially working | `scheme: onspaceapp` | Legacy scheme | Legacy scheme | Scheme name appears legacy and should be renamed/verified. |
| Share sheets | 🟡 Partially working | No special permission needed | Uses `expo-sharing` for QR sharing | Uses `expo-sharing` for QR sharing | Native behavior not verified. |
| Universal links | ⚪ Not started | Not found | Not configured | App links not configured | Public profile URL exists but no associated domains/app links found. |
| Background tasks | ⚪ Not started | Not found | Dependency installed | Dependency installed | No `expo-task-manager` usage found. |

## Environment Audit

| Item | Status | Notes |
| --- | --- | --- |
| `.env` | 🟡 Partially working | Exists locally and was loaded by Expo; exact values intentionally not documented. |
| `.env.example` | 🟡 Partially working | Exists; should be checked whenever env requirements change. |
| `app.json` | 🟡 Partially working | Expo config exists; scheme still `onspaceapp`; Supabase extras only in `app.config.js`. |
| `app.config.js` | 🟡 Partially working | Loads `.env`, logs public Supabase var presence, passes Supabase vars via `extra`. |
| `eas.json` | 🟡 Partially working | Development, preview, production profiles exist; builds not run in this audit. |
| `package.json` | 🟡 Partially working | Scripts and dependencies exist; many native dependencies appear unused. |
| Expo configuration | 🟡 Partially working | Expo Router, splash screen, dev client, web browser plugins configured. |
| Google Services | ⚪ Not started | No `google-services.json` or `GoogleService-Info.plist` found. |
| Apple Services | ⚪ Not started | No Apple service configuration found beyond bundle identifier and EAS config. |
| API keys | 🟡 Partially working | Public Supabase keys present locally; production/EAS values unknown. |
| Missing secrets | 🟡 Partially working | `OPENAI_API_KEY`, Stripe, RevenueCat, push, analytics/crash reporting secrets are unknown/missing from repo. |
| Incorrect values | 🟡 Partially working | `scheme: onspaceapp` appears incorrect/legacy for PAI. |

## Technical Debt

### Dead / Inactive Files

- `template/auth/mock/*`: mock auth service modules appear unused by active app.
- `template/auth/supabase/*`: template auth service modules appear unused by active app; custom auth lives in `contexts/AuthContext.tsx`.
- `package/`: appears to contain a vendored/generated EAS CLI package; confirm whether this should be committed.
- `scripts/reset-project.js`: contains a commented GitHub URL with an embedded token-like string; should be removed immediately even if invalid/old.

### Unused Components / Imports

- `npm run lint` reports 29 warnings, mostly unused variables/imports and hook dependency warnings.
- Notable files with warnings: `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/marketplace.tsx`, `app/(tabs)/profile.tsx`, `app/(tabs)/taxpot.tsx`, `app/admin-disputes.tsx`, `app/marketplace-job.tsx`, several feature/UI components.

### Unused Packages / Native Modules

Potentially unused based on import audit and existing docs:

- `expo-camera`
- `expo-document-picker`
- `expo-location`
- `expo-notifications`
- `expo-task-manager`
- `expo-contacts`
- `expo-sensors`
- `expo-video`
- Several React Native UI/utility packages may also be unused; run a dependency audit before removal.

### Deprecated Imports / Packages

- Lockfile contains transitive deprecated package notices, including `text-encoding` and `uuid@10 and below` messages.
- No app-level deprecated API was conclusively verified in this audit.

### Duplicate Logic

- Active custom auth context exists alongside template auth modules.
- `app.json` and `app.config.js` duplicate much of the Expo configuration; `app.config.js` is dynamic and likely the effective config.

### TODO / FIXME Comments

- No active app-source TODO/FIXME list was verified as a blocker in this audit; rerun a scoped `rg "TODO|FIXME"` before cleanup work.

### Legacy Code

- Legacy `onspaceapp` scheme remains.
- Template auth code remains after custom auth adoption.
- Commented token-like URL in `scripts/reset-project.js` is a security hygiene issue.

## App Loading Re-Audit (2026-06-19)

Purpose: check for repository-visible issues that would stop the app from loading before the next build attempt. This does not replace a real EAS device build or on-device runtime logs.

| Check | Status | Result | Notes |
| --- | --- | --- | --- |
| Expo public config resolution | 🟢 Working | `npx expo config --type public` completed successfully. | Config resolves with Expo SDK 53, iOS/Android/web platforms, EAS project ID, and Supabase public env values loaded. |
| TypeScript compile check | 🟢 Working | `npx tsc --noEmit` completed successfully. | No type-level blockers found. |
| Web/static startup bundle | 🟢 Working | `npm run build` completed successfully. | Root layout rendered during static export and Supabase client was created successfully on web. |
| Native device runtime | ⚪ Not verified | No EAS/device build was run in this audit. | Next evidence needed if the app still fails is an on-screen dev-build error or native logs. |
| Expo dependency diagnostics | ⚠️ Environment-limited | `npx expo-doctor` failed with npm registry 403; `npx expo install --check` failed with `fetch failed`. | These commands could not verify dependency compatibility in this environment because registry fetches failed. |

Repository-visible loading risks still worth watching:

1. Native startup depends on `@react-native-async-storage/async-storage` being available when the Supabase client is created on iOS/Android. The package is installed and TypeScript/build checks pass, but only a native dev/preview build can prove the TurboModule loads on-device.
2. Missing Supabase public env vars would throw during client creation. The current local config check shows they are set, but EAS preview/production env values still need verification.
3. `app.config.js` logs public Supabase env presence during config/build. This is not a load blocker, but it is noisy and should be cleaned later.
4. Web export proves the React tree can render in a static/web context; it does not prove native-only modules or native credentials are correct.

Conclusion: no new repository-visible P0 load blocker was found. The next best step is exactly the planned build attempt. If it fails, make a development build and capture the red-screen/native error so the next fix targets the real runtime failure instead of guessing.

## Build Status

| Target | Status | Details / Blockers |
| --- | --- | --- |
| Web | 🟢 Working | `npm run build` completed successfully and exported static routes. Warning: dynamic `require` in `template/core/client.ts` may not work in some deployed runtimes. |
| Android | ⚪ Not started | No Android build run in this audit. |
| iOS Development | ⚪ Not started | EAS development profile exists; not run. |
| iOS Preview | ⚪ Not started | EAS preview profile exists; not run. |
| Production | ⚪ Not started | EAS production profile exists; app-store readiness incomplete. |
| GitHub Actions | ⚪ Not started | No `.github/workflows` files found in the top-level file audit. |
| Expo | 🟡 Partially working | Expo config loads env and web export works. |
| EAS | 🟡 Partially working | `eas.json` and project ID exist; credentials/build execution not verified. |
| Current blockers | 🟡 Partially working | Payments, push, app-store compliance, native build verification, admin security, and backend deployment verification. |

## Production Checklist

- ☐ App icon: current icon exists but should be verified at required quality/sizes.
- ☐ Splash screen: configured; verify on native builds.
- ☐ Privacy policy: not found/verified.
- ☐ Terms: not found/verified.
- ☐ RevenueCat products: not configured/verified.
- ☐ Apple IAP products: not configured/verified.
- ☐ Google Play Billing products: not configured/verified.
- ☐ Stripe webhooks: not implemented.
- ☐ Stripe Connect onboarding: not implemented.
- ☐ Push notifications: not implemented.
- ☐ Analytics: not implemented/verified.
- ☐ Crash reporting: not implemented/verified.
- ☐ App Store metadata: not found/verified.
- ☐ Screenshots: not found/verified.
- ☐ App Store review compliance: not ready because subscription IAP/RevenueCat is missing and permissions may be overbroad.
- ☐ Google Play compliance: not ready because billing, data safety, and permissions are not verified.
- ☐ Supabase migrations applied to production: unknown.
- ☐ Supabase Edge Function deployed: unknown.
- ☐ `OPENAI_API_KEY` set in Supabase: unknown.
- ☐ EAS env vars configured for preview/production: unknown.
- ☐ Universal links/app links: not configured.
- ☐ Remove legacy `onspaceapp` scheme or confirm intentional.
- ☐ Remove commented token-like URL from `scripts/reset-project.js`.

## Current Blockers

### P0 - App cannot run

No P0 blocker was verified in this audit. Web export works.

### P1 - Major Production Blockers

1. Description: Contractor subscription is not production-ready.
   - Root cause: RevenueCat, Apple IAP, Google Play Billing, products, entitlements, and webhook sync are not implemented.
   - Files: `PAYMENTS.md`, `constants/config.ts`, `contexts/AuthContext.tsx`.
   - Recommended fix: Implement RevenueCat SDK, configure products/entitlements, and sync RevenueCat webhooks to Supabase.
   - Estimated effort: 3-5 days plus app-store/product setup time.

2. Description: Marketplace payments are not production-ready.
   - Root cause: Stripe Connect, payment intent creation, connected accounts, and webhooks are missing.
   - Files: `PAYMENTS.md`, `constants/config.ts`, `app/marketplace-job.tsx`, `supabase/migrations/20260613000001_initial_schema.sql`.
   - Recommended fix: Implement server-side Stripe Connect flow and webhook reconciliation.
   - Estimated effort: 4-7 days.

3. Description: Admin moderation is not secure/production-ready.
   - Root cause: Admin actions are in a client screen using the anon Supabase client; RLS intentionally does not grant regular users admin powers.
   - Files: `app/admin-disputes.tsx`, `supabase/migrations/20260613000004_rls_policies.sql`, `BACKEND.md`.
   - Recommended fix: Move admin actions behind Edge Functions/service-role with verified admin claims.
   - Estimated effort: 2-4 days.

4. Description: Native builds are unverified.
   - Root cause: EAS profiles exist, but iOS/Android development, preview, and production builds were not run in this audit.
   - Files: `eas.json`, `app.json`, `app.config.js`, `package.json`.
   - Recommended fix: Run EAS development/preview builds, fix native compile and permissions issues, then run production builds.
   - Estimated effort: 1-3 days depending on build failures.

### P2 - Feature Incomplete

1. Description: AI Edge Function deployment is unknown.
   - Root cause: Source exists, but deployment and `OPENAI_API_KEY` secret were not verified.
   - Files: `services/aiService.ts`, `supabase/functions/ai-quote/index.ts`.
   - Recommended fix: Deploy function, set secret, smoke-test from app.
   - Estimated effort: 0.5-1 day.

2. Description: Push notifications are placeholders.
   - Root cause: No push registration, token storage, sending backend, or credential verification found.
   - Files: `app/(tabs)/profile.tsx`, `package.json`, `app.json`.
   - Recommended fix: Implement or remove notification UI for launch.
   - Estimated effort: 2-4 days if implemented.

3. Description: Media/document uploads are placeholders.
   - Root cause: Supabase Storage disabled and upload UI shows coming-soon alerts.
   - Files: `app/(tabs)/profile.tsx`, `BACKEND.md`, `template/core/config.ts`.
   - Recommended fix: Either keep URL-only media and remove upload affordances, or implement storage buckets/policies/uploads.
   - Estimated effort: 1-3 days.

4. Description: App-store legal/compliance assets are missing or unknown.
   - Root cause: Privacy policy, terms, metadata, screenshots, data safety, and permission rationale are not in repo.
   - Files: `BUILD.md`, `app.json`.
   - Recommended fix: Prepare legal pages, metadata, screenshots, and review permissions.
   - Estimated effort: 2-5 days.

### P3 - Nice to Have

1. Description: Lint warnings remain.
   - Root cause: Unused imports/variables and hook dependency warnings.
   - Files: multiple app/component files listed in lint output.
   - Recommended fix: Clean warnings after feature decisions are made.
   - Estimated effort: 0.5-1 day.

2. Description: Legacy naming remains in deep link scheme.
   - Root cause: `scheme` remains `onspaceapp`.
   - Files: `app.json`, `app.config.js`.
   - Recommended fix: Rename to a PAI-specific scheme and verify OAuth/deep link redirects.
   - Estimated effort: 0.5 day plus QA.

3. Description: Duplicate dynamic/static Expo config.
   - Root cause: `app.json` and `app.config.js` both define overlapping config.
   - Files: `app.json`, `app.config.js`.
   - Recommended fix: Consolidate config source or document which file is authoritative.
   - Estimated effort: 0.5 day.

## Next Recommended Tasks

1. Remove the commented token-like URL from `scripts/reset-project.js` and rotate/revoke it if it was ever valid.
2. Verify Supabase production readiness: apply migrations, run `supabase/verify_schema.sql`, deploy `ai-quote`, and set `OPENAI_API_KEY`.
3. Run end-to-end QA for authentication, onboarding, marketplace jobs, applications/quotes, private jobs, invoices, reviews, and Tax Pot against the target Supabase project.
4. Implement RevenueCat + Apple IAP / Google Play Billing for contractor subscriptions.
5. Implement Stripe Connect marketplace payments and webhooks, or hide all payment CTAs until ready.
6. Secure admin dispute/review moderation with a server-side service-role path and admin authorization.
7. Run EAS iOS development and preview builds; then Android preview; document/fix native build blockers.
8. Decide on media/document upload scope: remove placeholders or implement Supabase Storage.
9. Implement or remove notification settings/push notification placeholders.
10. Prepare production compliance assets: privacy policy, terms, screenshots, app metadata, permissions review, data safety.
11. Clean lint warnings and unused dependencies once launch scope is frozen.
12. Rename/verify deep link scheme from `onspaceapp` to an intentional PAI scheme.

## Changelog

### 2026-06-19

- Summary: Created initial `PROJECT_STATUS.md` after repository audit. Verified web export and lint status. Documented implemented, partially working, stubbed, broken, and not-started areas separately.
- Files changed: `PROJECT_STATUS.md`.
- Features affected: Project status documentation, backend audit, payments audit, native feature audit, environment audit, technical debt, build status, production checklist, blockers, and next tasks.
- Bug fixes: None; documentation-only change.
- Build results:
  - `npm run lint`: passed with 29 warnings.
  - `npm run build`: passed; exported web static routes to `dist`.

### 2026-06-19 App-loading re-audit

- Summary: Re-audited for repository-visible issues that could stop the app from loading before the next build attempt. No new P0 loading blocker was found. Added an App Loading Re-Audit section with exact checks and limitations.
- Files changed: `PROJECT_STATUS.md`.
- Features affected: Build status, environment/config verification, startup risk tracking.
- Bug fixes: None; documentation-only audit update.
- Build results:
  - `npx expo config --type public`: passed; Expo public config resolves and public Supabase env values load.
  - `npx tsc --noEmit`: passed.
  - `npm run build`: passed; exported web static routes to `dist`.
  - `npx expo-doctor`: blocked by npm registry 403 in this environment.
  - `npx expo install --check`: blocked by registry/network fetch failure in this environment.
