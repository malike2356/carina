# Carina Mobile: EAS build and store distribution

Production builds use [EAS Build](https://docs.expo.dev/build/introduction/). Push notifications (FCM/APNs) require a dev client or store build; Expo Go cannot receive remote push in production.

Bundle identifiers (must match across `app.config.ts`, App Store Connect, and Play Console):

| Platform | Identifier |
|---|---|
| iOS | `uk.carinaai.mobile` |
| Android | `uk.carinaai.mobile` |

## Local dev

Copy `.env.example` to `.env` and fill in values before starting the dev server:

```bash
cd carinaMobile
cp .env.example .env
pnpm install
pnpm start
```

### What works in Expo Go

| Feature | Expo Go | EAS dev / preview / production |
|---|---|---|
| Chat streaming | Yes | Yes |
| Local task notifications | Partial | Yes |
| Remote push (FCM/APNs) | No | Yes (cloud + real EAS project id) |
| Voice input | No | Yes |
| On-device mini LLMs (Llama / Qwen / Gemma) | No | Yes (New Architecture + llama.rn linked) |
| Android home widget | No | Yes (manual add from launcher) |

Expo Go is fine for UI and API work against live Carina Cloud, but it cannot run native-only features. For push, voice, or the widget, install an EAS build on a physical device.

### Choosing an EAS profile

| Profile | When to use |
|---|---|
| `development` | Day-to-day native work; dev client with debugging, iOS simulator supported |
| `preview` | Internal QA on real devices; sideloadable APK / internal IPA with production env baked in |
| `production` | TestFlight and Play internal track submissions; auto-increments build numbers |

`preview` and `production` bake `EXPO_PUBLIC_CARINA_CLOUD_URL` and `EXPO_PUBLIC_SCOUT_TRUST_URL` from `eas.json`; `development` reads them from your local `.env`.

## First device build (preview profile)

Use this flow before TestFlight or Play store submission:

1. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_EAS_PROJECT_ID` from `eas init` (not the placeholder uuid).
2. Log in and link the EAS project:

```bash
cd carinaMobile
npx eas login
npx eas init
```

3. Build and install on device:

```bash
pnpm build:preview
# or one platform:
npx eas build --profile preview --platform android
npx eas build --profile preview --platform ios
```

4. When the build finishes, open the EAS install link on your phone (Android APK sideload or iOS internal ad hoc).
5. Sign in to Carina Cloud, enable **Remote push** under More, and send a chat message with the app backgrounded to verify task alerts.

## One-time setup

### 1. EAS project

```bash
cd carinaMobile
pnpm add -D eas-cli
npx eas login
npx eas init
```

Copy the project ID into `.env` (or CI secrets):

```bash
EXPO_PUBLIC_EAS_PROJECT_ID=your-uuid-from-eas-init
```

### 2. Push credentials

Remote push registers with Carina Cloud at `POST /app/auth/push/register` (session cookie). The app only registers when:

- Carina Cloud mode with a signed-in user
- Remote push toggle enabled in More
- Valid `EXPO_PUBLIC_EAS_PROJECT_ID` baked into the build
- Physical device with notification permission granted

**iOS (APNs):**

1. Run `npx eas credentials` for the iOS app.
2. Upload or generate an APNs key in your Apple Developer account.
3. EAS stores the key for preview and production builds.

**Android (FCM):**

1. Create a Firebase project and download `google-services.json`.
2. Set `GOOGLE_SERVICES_JSON` to the file path in `.env` (see `.env.example`).
3. Run `npx eas credentials` to upload FCM credentials for Android builds.

Requires hosted Carina Cloud with Postgres migrations applied (`mobile_push_tokens`, `scout_alert_watermarks`).

### 3. iOS (TestFlight internal)

1. Create an App Store Connect app with bundle ID `uk.carinaai.mobile`.
2. Configure APNs via `npx eas credentials` (see push credentials above).
3. Update the `eas.json` submit block: replace `REPLACE_WITH_APP_STORE_CONNECT_APP_ID` with the numeric App Store Connect app ID (App Information > Apple ID) and `REPLACE_WITH_APPLE_TEAM_ID` with your Apple Developer team ID (Membership page). Builds work without these; only `eas submit` needs them.
4. Build and submit:

```bash
npx eas build --platform ios --profile production
npx eas submit --platform ios --profile production --latest
```

5. In App Store Connect, add internal testers under TestFlight.

### 4. Android (Play internal track)

1. Create a Google Play app with package `uk.carinaai.mobile`.
2. Create a service account with Play Console API access; save JSON as `google-play-service-account.json` (gitignored; path referenced in `eas.json` submit block).
3. Configure FCM via `google-services.json` and `npx eas credentials`.
4. Build and submit:

```bash
npx eas build --platform android --profile production
npx eas submit --platform android --profile production --latest
```

5. Promote the internal testing release in Play Console.

### 5. Android home screen widget

The **Carina tasks** widget is Android-only and requires a preview or production EAS build:

1. Install the preview or production APK on your device.
2. Long-press the home screen and open the widget picker.
3. Find **Carina tasks** and place it on a home screen.
4. The widget shows running and completed task counts from local storage; it updates when tasks change in the app.

Expo Go cannot register widgets.

## Build profiles

| Profile | Use |
|---|---|
| `development` | Dev client with debugging |
| `preview` | Internal APK/IPA for QA |
| `production` | TestFlight / Play internal or production |

## Commands

```bash
pnpm build:ios        # production iOS
pnpm build:android    # production Android
pnpm build:preview    # internal QA builds (both platforms)
```

## Team-supplied store credentials

These files and values are never committed; each teammate or CI runner supplies them locally:

| Item | Location / action |
|---|---|
| App Store Connect app ID | `eas.json` submit `ascAppId` (replace placeholder) |
| Apple team ID | `eas.json` submit `appleTeamId` (replace placeholder) |
| Play service account JSON | `google-play-service-account.json` in `carinaMobile/` (gitignored) |
| Firebase `google-services.json` | Path via `GOOGLE_SERVICES_JSON` in `.env` |

## Monorepo note (EAS upload)

Git root is `/opt/lampp/htdocs`, so a naive `eas build` from `carinaMobile/` can try to archive the whole tree (multi-GB) and hang or fail.

**Reliable preview build:** copy the app to an isolated git repo, then build:

```bash
SRC=/opt/lampp/htdocs/verlox/carina/03-frontends/client-apps/carinaMobile
DEST=/tmp/carina-mobile-eas-src
rsync -a --exclude node_modules --exclude .expo --exclude android/app/build \
  --exclude android/.gradle --exclude ios/Pods --exclude .env --exclude .git "$SRC/" "$DEST/"
cd "$DEST" && git init && git add -A && git commit -m 'eas snapshot'
pnpm install
npx eas build --profile preview --platform android --non-interactive
```

Then download the artifact from the Expo build page and publish to:

`app.carinaai.uk/public/downloads/carina-mobile.apk` (VPS bind mount for Aiva sideload).

A root `/opt/lampp/htdocs/.easignore` excludes heavy unrelated trees; prefer the isolated copy for clean uploads.

## Before store release

Complete the manual device matrix in [DEVICE_QA.md](./DEVICE_QA.md) on a **preview** build before TestFlight or Play internal promotion. All P0 and P1 rows must pass; document P2/P3 items in the Known limitations section of that file.

## Environment

Template with all variables: [`.env.example`](./.env.example). Copy it to `.env`; never commit real values.

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_EAS_PROJECT_ID` | Expo push token project ID from `eas init` |
| `EXPO_PUBLIC_CARINA_CLOUD_URL` | Default `https://app.carinaai.uk` |
| `EXPO_PUBLIC_SCOUT_TRUST_URL` | Default `https://console.labyrinthscout.com/api/public/trust` |
| `EXPO_OWNER` | Optional Expo account owner slug |
| `GOOGLE_SERVICES_JSON` | Path to Firebase config for Android FCM (native builds) |
