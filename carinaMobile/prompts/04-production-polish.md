# Carina Mobile - Prompt 04: Production polish

## What you are building

Production-readiness pass: loading, offline, auth errors, and navigation. The app should feel finished on device without adding new product scope.

**Working directory:** `/opt/lampp/htdocs/verlox/carina/carinaMobile`

Polish and correctness only. No new features.

---

## Goal

- App loads cleanly with no flash of wrong screens
- Failure states are visible and recoverable
- Navigation feels deliberate
- App reads as a finished companion to the current Carina system

---

## Shell and navigation files

```
carinaMobile/app/_layout.tsx
carinaMobile/app/(tabs)/_layout.tsx
carinaMobile/app/index.tsx
carinaMobile/src/components/ScreenShell.tsx
carinaMobile/src/components/OfflineQueueBanner.tsx
carinaMobile/src/components/ConnectionStatusChip.tsx
carinaMobile/src/components/SessionDrawer.tsx
carinaMobile/src/components/ChatComposer.tsx
carinaMobile/app/(tabs)/chat/index.tsx
carinaMobile/src/hooks/useDeepLinks.ts
carinaMobile/src/hooks/useOfflineQueue.ts
```

---

## Tasks

### 1. Loading states

- **Index redirect:** spinner while auth ready; no flash of tabs before login check completes
- **Chat:** gate composer until `useChatSession.ready`
- **Trust/packs/memory/usage:** skeleton or spinner, not blank content area

### 2. Offline behavior

- `OfflineQueueBanner` shows queue count and flush action
- Queued messages replay with `fromQueue: true` without duplicating user bubbles
- Network loss mid-stream queues message and shows recoverable error (already partial in `useChatSession`; verify end-to-end)

### 3. Auth errors

| Scenario | Expected UX |
|---|---|
| Login failure | Backend message, retry, link back to onboarding |
| Expired cloud session | Redirect to login with "Session expired", not silent chat failure |
| Self-hosted connection failure | Retry + edit URL on instance screen |

### 4. Copy audit

- Remove CLI-only assumptions
- Suggested prompts stay general-purpose (`src/config/defaults.ts`)
- Trust tab explains Scout relationship plainly
- No aspirational labels for unavailable features

### 5. Navigation hierarchy

- Chat is default tab
- Deep links (`useDeepLinks`) open correct session or task
- Back navigation from memory/packs/usage/instance returns cleanly to More or prior tab
- Session drawer accessible from chat header without layout jump

### 6. Touch and layout

- `SafeAreaView` on chat header and composer
- `KeyboardAvoidingView` behavior correct on iOS and Android
- Minimum 44pt touch targets on primary actions (send, sign in, retry)
- FlatList scroll-to-end on new messages

### 7. Root wiring

- Confirm `usePushRegistration` runs for signed-in cloud users (from Prompt 03)
- Confirm `useNotificationSetup` and `useScoutAlertMonitor` do not throw when offline

### 8. Shared UI helpers (optional)

If you introduce reusable error/disabled cards, add colocated tests.

---

## Acceptance criteria

- No dead-end screens
- Failures show message + retry path
- Navigation feels deliberate
- App reads as a finished companion, not a dev prototype
- `pnpm typecheck && pnpm test` pass

---

## Validation

```bash
cd /opt/lampp/htdocs/verlox/carina/carinaMobile
pnpm typecheck
pnpm test
```

Manual smoke:

1. Kill network mid-chat; queue banner appears; flush on reconnect
2. Sign out and back in; no stale user state on trust tab
3. Open memory from More; back returns to More
4. Rotate device or open keyboard; composer remains usable
