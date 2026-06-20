# Carina Mobile - Prompt 03: Push, voice, widget, and EAS device builds

## What you are building

Finish native-only features so the app is ready for real device builds. Expo Go must not pretend to support push, voice, or the Android widget.

**Working directory:** `/opt/lampp/htdocs/verlox/carina/carinaMobile`

Keep scope limited to mobile build/runtime readiness. Do not refactor unrelated screens.

---

## Goal

- Device-only features are clearly gated in UI
- EAS build path is complete and reproducible
- Push registration matches the current Carina Cloud backend

---

## Native feature files

```
carinaMobile/src/hooks/useVoiceInput.ts
carinaMobile/src/hooks/usePushRegistration.ts
carinaMobile/src/lib/push-registration.ts
carinaMobile/src/api/push-client.ts
carinaMobile/src/lib/widget-sync.ts
carinaMobile/src/widgets/TaskCountWidget.tsx
carinaMobile/src/widgets/register-widget.tsx
carinaMobile/app.config.ts
carinaMobile/eas.json
carinaMobile/DEPLOY.md
carinaMobile/app/(tabs)/chat/index.tsx      (voice button)
carinaMobile/app/(tabs)/more/index.tsx      (remote push toggle)
```

---

## Backend push contract (Carina Cloud)

- `POST /app/auth/push/register` (session cookie auth)
- Unregister on sign-out or when remote push disabled
- Stream uses `notify=1` query param when remote push enabled (`src/api/chat-stream.ts`)
- Requires real EAS project id (not placeholder `00000000-0000-4000-8000-000000000001`)
- Server tables: `mobile_push_tokens`, `scout_alert_watermarks` (Postgres migrations on cloud)

---

## Expo Go vs device build

| Feature | Expo Go | EAS dev/preview/production |
|---|---|---|
| Chat streaming | Yes | Yes |
| Local task notifications | Partial | Yes |
| Remote push (FCM/APNs) | No | Yes |
| Voice input | No | Yes |
| Android home widget | No | Yes |

---

## Tasks

### 1. Centralize native capability detection

Create `src/lib/native-capabilities.ts` (or equivalent) exposing:

- `isExpoGo` vs dev client vs store build
- `hasValidEasProjectId` (reuse `getEasProjectId` from `push-registration.ts`)
- `isPushAvailable`, `isVoiceAvailable`, `isWidgetAvailable`

Gate UI from this helper instead of scattered try/catch.

### 2. UI truthfulness

- **Voice button** in `ChatComposer`: disabled state + short explanation in Expo Go
- **Remote push toggle** in More: explain EAS project id + device build requirement when unavailable
- **Android widget**: note in More or DEPLOY that preview/production build + manual widget add is required

### 3. Push registration path

Register only when all are true:

- Cloud mode
- Hosted user signed in
- Remote push enabled in prefs
- Valid EAS project id
- Physical device (`expo-device`)
- Notification permission granted

Unregister on:

- Sign out
- Mode switch to self-hosted
- Remote push toggle off

Confirm `push-client.ts` endpoints match current core hosted routes.

### 4. EAS config hardening

- Validate bundle id `uk.carinaai.mobile` and Android package name are consistent in `app.config.ts` and `eas.json`
- Document `ascAppId`, `appleTeamId`, `google-play-service-account.json` as team-supplied in `DEPLOY.md`
- Ensure `EXPO_PUBLIC_SCOUT_TRUST_URL` is in build env (from Prompt 00 if not done)

### 5. Update `DEPLOY.md`

Add:

- Step-by-step first device build using `preview` profile
- Push credential setup: iOS APNs key, Android FCM via `google-services.json`
- "What works in Expo Go" table
- Android widget setup steps

### 6. Wire `usePushRegistration` in root layout

If not already active for signed-in cloud users, mount in `app/_layout.tsx` or `RootShell`.

### 7. Add tests

Test native-capabilities gating logic with mocked `Constants`, `Device`, and Expo Go detection.

```
carinaMobile/src/lib/native-capabilities.test.ts
```

---

## Acceptance criteria

- Expo Go never shows native features as fully working when they are not
- Push registration only runs when all prerequisites are met
- `DEPLOY.md` is accurate for `carinaMobile` paths and env vars
- Tests cover gating helpers
- `pnpm typecheck && pnpm test` pass

---

## Validation

```bash
cd /opt/lampp/htdocs/verlox/carina/carinaMobile
pnpm typecheck
pnpm test
```

Device validation (preview build):

1. Remote push toggle explains requirements in Expo Go
2. On preview build with real EAS project id: push registers after sign-in
3. Voice button disabled in Expo Go; works on preview build
4. Android widget can be added from launcher after preview install
