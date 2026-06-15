# Building & Running PAI

PAI is an Expo (React Native) app. It uses custom native modules, so **Expo Go
cannot run it** — you need an EAS **development** or **preview** build installed
on your device. All builds happen in the cloud on your Expo account (no Mac
required to build).

## 0. Prerequisites (one time)
```bash
npm install -g eas-cli       # the EAS command-line tool
eas login                    # sign in to your Expo account
npm install --legacy-peer-deps   # install JS deps (see note below)
```
> **Why `--legacy-peer-deps`:** the project is on React 19 while a couple of
> libraries still declare React ≤18 as a peer. A committed `.npmrc` sets this
> automatically, so EAS cloud builds and local installs both work.

## 1. Link the repo to your Expo account (one time)
```bash
eas init        # creates the EAS project and writes extra.eas.projectId into app.json
```

## 2. Provide the backend env vars to EAS (one time)
The app reads its Supabase connection from two **public** client vars (safe to
expose — they ship in every app bundle):
```bash
eas env:create --name EXPO_PUBLIC_SUPABASE_URL      --value "https://<your-ref>.supabase.co" --visibility plaintext --environment preview --environment production
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<your-anon-key>"                --visibility plaintext --environment preview --environment production
```
(Values are in your local `.env`.)

## 3. Preview it on your iPad (fastest)
```bash
eas device:create                         # register your iPad's UDID (one time, follow the link)
eas build --profile preview --platform ios
```
When it finishes, open the install link / scan the QR on the iPad to install PAI.

## 4. Live-reload development build (optional)
```bash
eas build --profile development --platform ios   # install once on the iPad
npx expo start --dev-client                       # then reload code instantly
```

## 5. Ship to TestFlight (when ready)
Requires an Apple Developer account + an app record in App Store Connect.
```bash
eas build --profile production --platform ios
eas submit --profile production --platform ios
```

---

## Before a production submission — open items
- **Payments policy ⚠️** — the £25/mo subscription likely needs Apple In-App
  Purchase (Stripe is not allowed for digital subscriptions). Decide this first.
- **Privacy policy URL** + App Store screenshots + data-safety questionnaire.
- **Unused native modules** — `react-native-webrtc`, `react-native-maps`,
  `@stripe/stripe-react-native`, camera/location/etc. are installed but not used
  in the current code. They still compile into the binary (bloat + possible
  build friction). Removing the unused ones is recommended before the first
  production build.
- **App icon** — current logo is upscaled from ~382px; a crisp 1024×1024 export
  gives the sharpest App Store icon.
