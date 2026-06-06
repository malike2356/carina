# Mobile API

**Last updated:** 2026-05-25 (mobile-wrapper sync)

## Drift gate

`php artisan api:docs:build --check` enforces three-way parity between (1) registered Laravel routes, (2) `config/api_docs.php` `mobile_status`, and (3) `brain/prompts/19-mobile-api.md` contract. CI fails on drift. The latest sync (2026-05-25) brought all 127 mobile routes into agreement and added 16 missing thin client wrappers in `propreneur-mobile/v2/src/api/`.

## 2026-05-25 mobile sync - screens shipped

Existing screens augmented with the new wrappers:

- `app/carina/index.tsx` - long-press a conversation card → confirm delete (`DELETE /carina/conversations/{id}`).
- `app/carina/[id].tsx` - attach-document button in the composer (`POST /carina/conversations/{id}/documents`).
- `app/documents/[id].tsx` - Edit details (title + notes) and Delete actions using `PUT` / `DELETE /documents/{id}`.
- `app/documents/index.tsx` - "Scan compliance certificate" header button → new flow.
- `app/mentoring/[id].tsx` - programme edit, delete, and create-cohort form using `PUT` / `DELETE /programmes/{p}` and `POST /programmes/{p}/cohorts`.
- `app/mentoring/goals/[mentorshipId].tsx` - tap a goal to inline-edit, long-press to delete (`PUT` / `DELETE /goals/{g}`).
- `app/crm/[id].tsx` - Investor scoring breakdown panel rendered when `GET /crm/contacts/{c}/investor-score` succeeds.
- `app/admin/billing.tsx` - invoice + plan rows now navigate into the new detail screens.
- `app/(tabs)/index.tsx` - investor-portal stat cards link to the new `/assets` screen.

New screens added:

- `app/assets/_layout.tsx` + `app/assets/index.tsx` - List + Allocation tabs powered by `GET /assets`, `GET /assets/allocation`, `GET /assets/net-worth`.
- `app/admin/invoice/[id].tsx` - invoice detail (`GET /billing/invoices/{i}`).
- `app/admin/plan/[id].tsx` - plan detail (`GET /billing/plans/{p}`).
- `app/documents/scan-cert.tsx` - camera / library certificate OCR via `POST /documents/scan-cert` with prefill follow-up into compliance create.

All screens pass `npx tsc --noEmit`.

## Overview
Backend support for the Propreneur mobile app (iOS/Android). Handles device registration, session management with token refresh, offline sync queues, push notifications, and crash reporting.

## Android app download (tenant MIS)

Tenants discover the sideload APK from:

1. **Help Center** - article *Propreneur Mobile App* (`dashboard-navigation/propreneur-mobile-app`) with download card + QR
2. **Settings → Account** - *Mobile app (Android)* when `MOBILE_ANDROID_APK_PATH` or `MOBILE_ANDROID_APK_URL` is set
3. **Login page** - footer link when configured
4. **Profile menu** - *Get mobile app*

**Config** (`config/mobile.php`):

| Env | Purpose |
|-----|---------|
| `MOBILE_ANDROID_VERSION` | Shown in UI (default `1.0.0`) |
| `MOBILE_ANDROID_APK_PATH` | Server filesystem path (preferred) - served by `GET /mobile/android` |
| `MOBILE_ANDROID_APK_URL` | External HTTPS URL - route redirects |
| `MOBILE_IOS_APP_URL` | Reserved (null until App Store) |

**Route:** `tenant.mobile.android` → `MobileAppDownloadController@android` (throttle 30/min). No auth required so invited staff can download before first login.

**Deploy pattern:** copy `propreneur-mobile/v2/dist/propreneur-mobile-release.apk` to e.g. `public/downloads/propreneur-mobile.apk` on VPS and set `MOBILE_ANDROID_APK_PATH` or host at `https://propreneur.uk/app/android` and set `MOBILE_ANDROID_APK_URL`.

**Ops runbook (follow every release):** `docs/MOBILE_ANDROID_APK_PUBLISH_GUIDE.md`

**Sideload steps for users:** enable Install unknown apps → install APK → sign in with workspace slug + email/password.

## Core Features
- **Device registration** - Register iOS and Android devices with unique identifiers
- **Session management** - Token and refresh token pattern for secure mobile authentication
- **Offline sync** - Queue changes when offline and sync when connectivity returns
- **Push notifications** - Store device push tokens for notification delivery
- **Crash reporting** - Automatic crash report submission with full stack traces and device metadata
- **App configuration** - Remote configuration endpoint for app settings

## Getting Started
Mobile API features work automatically through the Propreneur mobile app:
1. Install the Propreneur mobile app (see **Android app download** above)
2. Log in with your workspace credentials (workspace slug + email + password)
3. The app registers your device automatically
4. Push notifications arrive for key events (when FCM is configured on the server)
5. Work offline - changes sync when you reconnect

## Key Workflows

### Device registration
When you first log in on mobile, your device registers with a unique identifier, OS version, and app version. Your push notification token is stored for notifications. You can view and remove registered devices from settings.

### Session management
Mobile sessions use a token + refresh token pattern. Access tokens expire after a period; the refresh token automatically obtains a new one without requiring re-login. Sessions track last activity for active session management.

### Offline sync
When you make changes offline (e.g., update a deal or add a note), the change is queued. When connectivity is restored, the queue syncs in order. If conflicts arise (same record changed on both mobile and web), you can resolve them.

### Crash reporting
If the app crashes, a report is automatically submitted with the error message, stack trace, app version, OS version, and device model. This helps the development team diagnose and fix issues.

## Business Rules
- Each device uniquely identified by a device UUID
- Sessions use token + refresh token pattern with expiry
- Offline sync queues changes and resolves conflicts on reconnect
- Push tokens stored per device for notification delivery
- Crash reports include full stack trace with device/OS metadata

## Best Practices
- Keep the mobile app updated for the latest features and bug fixes
- Check your device list periodically and remove old ones
- Ensure notifications are enabled for important alerts
- If you encounter sync conflicts, review both versions before choosing

## Related Features
- **All modules** - Mobile access to leads, deals, properties, contacts, and more
- **Comms & Engagement** - Push notifications via registered devices
