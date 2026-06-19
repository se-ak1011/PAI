# iOS startup watchdog handoff

## Why the previous PR was reverted

The previous PR attempted to reduce iOS launch work by deferring Supabase startup and enabling Metro `inlineRequires`. It was reverted because the GitHub PR branch developed merge conflicts in the root provider files and was not reliably updating from this environment.

The revert removes the PR's code changes so the next attempt can start from a clean branch without doubled-up or conflicting implementations.

## Original crash symptom

The iOS crash log showed a `FRONTBOARD` / `0x8BADF00D` watchdog termination during scene creation. That means iOS killed the app because the first scene did not become responsive within the watchdog window.

The browser still rendered because the failure was specific to the native iOS startup path, not a general web render failure.

## Startup areas already inspected

The startup audit focused on:

- `app/_layout.tsx`
- root providers
- auth initialization
- Supabase startup
- Google Sign-In initialization
- RevenueCat initialization
- Stripe initialization
- notifications
- calendar
- font loading

The strongest app-level suspect was synchronous/root-level Supabase initialization during provider startup.

## What the reverted PR tried to change

The reverted PR changed these files:

- `contexts/AuthContext.tsx`
- `contexts/JobsContext.tsx`
- `contexts/TaxPotContext.tsx`
- `metro.config.js`

The intended behavior was:

1. Avoid importing and creating the Supabase client during the first provider render.
2. Delay Supabase initialization until after first paint/interactions.
3. Keep jobs and tax sync out of the first-screen path.
4. Enable Metro `inlineRequires` to reduce eager JS module evaluation.

## Important conflict-resolution note for the next attempt

If this change is attempted again, do not leave both eager and deferred Supabase implementations in the same provider.

Avoid this top-level value import in root-mounted providers if the goal is to defer Supabase startup:

```ts
import { getSupabaseClient } from '@/template/core';
```

A clean redo should choose one implementation only. If deferring Supabase startup, use a single shared helper and remove the eager provider-level client creation rather than adding deferred code beside it.

## Suggested staged redo

1. Start from latest `main` in a fresh branch.
2. Make one small change at a time.
3. First, add startup instrumentation/logging around root render and auth initialization.
4. Then defer only the confirmed blocking operation.
5. Run `npx tsc --noEmit` and `npm run lint`.
6. Build an iOS preview and test on device.
7. Only after the screen renders reliably, plan the larger infrastructure revamp.

## Later infrastructure revamp plan

Once the iPhone screen bug is fixed, do the full app infrastructure revamp in separate PRs:

1. Node/CI/package-manager cleanup.
2. Expo doctor and dependency audit.
3. Expo SDK upgrade in stages.
4. Native iOS preview build validation.
5. Android and web validation.
6. Startup/performance profiling.
