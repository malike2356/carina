# Carina Mobile: EAS build and store distribution

Production builds use [EAS Build](https://docs.expo.dev/build/introduction/). Push notifications (FCM/APNs) require a dev client or store build; Expo Go cannot receive remote push in production.

## One-time setup

### 1. EAS project

```bash
cd mobile
pnpm add -D eas-cli
npx eas login
npx eas init
```

Copy the project ID into `.env` (or CI secrets):

```bash
EXPO_PUBLIC_EAS_PROJECT_ID=your-uuid-from-eas-init
```

### 2. iOS (TestFlight internal)

1. Create an App Store Connect app with bundle ID `uk.carinaai.mobile`.
2. Run `npx eas credentials` and configure push notification key (APNs).
3. Update `eas.json` submit block with `ascAppId` and `appleTeamId`.
4. Build and submit:

```bash
npx eas build --platform ios --profile production
npx eas submit --platform ios --profile production --latest
```

5. In App Store Connect, add internal testers under TestFlight.

### 3. Android (Play internal track)

1. Create a Google Play app with package `uk.carinaai.mobile`.
2. Create a service account with Play Console API access; save JSON as `google-play-service-account.json` (gitignored).
3. Upload FCM credentials via `npx eas credentials` (Firebase `google-services.json` for native FCM).
4. Build and submit:

```bash
npx eas build --platform android --profile production
npx eas submit --platform android --profile production --latest
```

5. Promote the internal testing release in Play Console.

### 4. Push notifications (Carina Cloud)

Remote task and Scout alerts register the device Expo push token with Carina Cloud:

- `POST /app/auth/push/register` (session cookie auth)
- Server sends via Expo Push API when chat stream completes (`notify=1`) or Scout poller finds new alerts

Requires hosted Carina Cloud with Postgres migrations applied (`mobile_push_tokens`, `scout_alert_watermarks`).

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

## Phase 9 native features (dev build required)

These features need an EAS development or production build (not Expo Go):

- Voice input (`expo-speech-recognition`)
- Android home screen widget (`react-native-android-widget`)
- Remote push (FCM/APNs)

After adding widgets or voice, run `npx eas build --profile preview` and install on device.

### Android widget

Add the **Carina tasks** widget from the launcher widget picker. It shows running and completed task counts from local storage.

## Environment

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_EAS_PROJECT_ID` | Expo push token project ID |
| `EXPO_PUBLIC_CARINA_CLOUD_URL` | Default cloud URL (preview/production) |
| `GOOGLE_SERVICES_JSON` | Path to Firebase config for Android FCM |
