# Welcome to PAI

PAI empowers anyone to turn ideas into powerful AI applications in minutes—no coding required. This repository contains the PAI client app (built with React Native and Expo) which demonstrates cross-platform features and integrations for iOS, Android, and Web.

## Getting Started

### 1. Install Dependencies

```bash
npm install
# or
yarn install
```

### 2. Start the Project

- Start the development server (choose your platform):

```bash
npm run start         # Start Expo development server
npm run android       # Launch Android emulator
npm run ios           # Launch iOS simulator
npm run web           # Start the web version
```

- Reset the project (clear cache, etc.):

```bash
npm run reset-project
```

### 3. Lint the Code

```bash
npm run lint
```

## Backend & Data Architecture

PAI uses a single **production Supabase backend**. Database, auth (email/password
and Google OAuth) and edge functions all live on that instance.

- **Endpoint & credentials**: `EXPO_PUBLIC_SUPABASE_URL` and
  `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env`. Both are required at startup.
- **Client**: created exactly once in `template/core/client.ts` and consumed
  app-wide via `getSupabaseClient()` from `@/template`. Do not call
  `createClient()` anywhere else.
- **Auth**: implemented in `contexts/AuthContext.tsx` (the template's bundled
  auth module was removed as dead code).
- **Tables**: `user_profiles`, `job_posts`, `job_applications`, `private_jobs`,
  `reviews`, `manual_income`, `disputes`, `customer_reliability_scores`.
  No storage buckets are used yet; avatar/portfolio images are URL strings.
- **Edge functions**: `supabase/functions/ai-quote/index.ts` is the source for
  the AI quote generator (calls OpenAI server-side via `OPENAI_API_KEY` set in
  the backend environment). The deployed copy is what runs — editing the file here has no effect until it is redeployed.
- **Schema & RLS**: managed in your Supabase project (migrations are included
  in `supabase/migrations/`). Anything readable by the `anon` role is
  effectively public; review RLS policies before exposing new data.
- **Public URLs**: shareable contractor profile links are built by
  `getContractorProfileUrl()` in `constants/config.ts`
  (`https://pai.app/contractor/{id}`), served by the web build.

## Main Dependencies

- React Native: 0.79.4
- React: 19.0.0
- Expo: ~53.0.12
- Expo Router: ~5.1.0
- Supabase: ^2.50.0
- Other commonly used libraries:  
  - @expo/vector-icons  
  - react-native-paper  
  - react-native-calendars  
  - lottie-react-native  
  - react-native-webview  
  - and more

For a full list of dependencies, see [package.json](./package.json).

## Development Tools

- TypeScript: ~5.8.3
- ESLint: ^9.25.0
- @babel/core: ^7.25.2

## Contributing

1. Fork this repository
2. Create a new branch (`git checkout -b main`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

## License

This project is private ("private": true). For collaboration inquiries, please contact the author.

---

Feel free to add project screenshots, API documentation, feature descriptions, or any other information as needed.

## Vercel (Expo Web) Deployment

To deploy the Expo web build to Vercel as a static site:

1. Install dependencies and build the web app:

```bash
npm install
npm run vercel-build
```

2. Push your repo and connect it to Vercel. Vercel will run the `vercel-build` script and publish the `web-build` directory created by Expo.

If you prefer, Vercel will also respect the `build` script (`npm run build`). The project is configured via `vercel.json` to serve the static `web-build` output.
