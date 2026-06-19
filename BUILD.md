# Building & Running PAI

PAI is an Expo (React Native) app. The primary native preview path is still an
EAS **development** or **preview** build installed on your device, but the repo
also includes an **Expo Go smoke-preview mode** for quick JavaScript/UI checks.
All cloud builds happen on your Expo account (no Mac required to build).

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

## 3. Quick smoke preview in Expo Go

Use this when you only need to verify JavaScript/UI startup in the stock Expo Go
app:

```bash
npm run start:go
# or, if your phone cannot reach your local machine directly:
npm run start:go:tunnel
```

The Expo Go script forces `npx expo start --go` and sets `EXPO_GO=1`, which
omits the `expo-dev-client` config plugin for that server session. If a screen
starts using a native library that is not bundled in Expo Go, use the development
build path below instead.

## 4. Preview it on your iPad with an installable build
```bash
eas device:create                         # register your iPad's UDID (one time, follow the link)
eas build --profile preview --platform ios
```
When it finishes, open the install link / scan the QR on the iPad to install PAI.

## 5. Live-reload development build (optional)
```bash
eas build --profile development --platform ios   # install once on the iPad
npx expo start --dev-client                       # then reload code instantly
```

## 6. Ship to TestFlight (when ready)
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
