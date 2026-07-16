# viCal - External Calendar Sync (Google Calendar & Outlook)

**Last updated:** 2026-05-20
**Feature flag:** `vcal_calendar_sync` (off by default)
**Routes:** `/vical/calendar/*` in tenant routes

## Overview

Sync viCal bookings bi-directionally with Google Calendar and Microsoft Outlook (via Microsoft Graph). When a booking is created, updated, or cancelled, the external calendar event is created/updated/deleted automatically. Managed per-user (each staff member connects their own calendar).

## Data model (tenant DB)

| Table | Purpose |
|-------|---------|
| `vcal_calendar_connections` | Per-user OAuth connection: `provider` (google/microsoft), `access_token`, `refresh_token`, `expires_at`, `calendar_id`, `email`, `is_active` |
| `vcal_booking_calendar_events` | Maps `vcal_booking_id` → `external_event_id` per connection for update/delete |

## OAuth flow

```
GET  /vical/calendar/{provider}/connect     → redirect to Google/Microsoft OAuth screen
GET  /vical/calendar/{provider}/callback    → exchange code, store VcalCalendarConnection
POST /vical/calendar/{provider}/disconnect  → revoke token, delete connection
GET  /vical/calendar/{provider}/calendars   → list user's calendars (JSON)
POST /vical/calendar/{provider}/select      → set active calendar_id
```

Providers: `google` and `microsoft`.

### Google OAuth scopes
```
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/userinfo.email
```

### Microsoft OAuth scopes
```
offline_access Calendars.ReadWrite User.Read
```

## Required env vars

```
GOOGLE_CALENDAR_CLIENT_ID=
GOOGLE_CALENDAR_CLIENT_SECRET=
GOOGLE_CALENDAR_REDIRECT_URI=https://{slug}.propreneur.uk/vical/calendar/google/callback

MICROSOFT_CALENDAR_CLIENT_ID=
MICROSOFT_CALENDAR_CLIENT_SECRET=
MICROSOFT_CALENDAR_TENANT_ID=common
MICROSOFT_CALENDAR_REDIRECT_URI=https://{slug}.propreneur.uk/vical/calendar/microsoft/callback
```

## OAuth redirect URIs to register

When setting up OAuth apps:
- Google Cloud Console: `https://{slug}.propreneur.uk/vical/calendar/google/callback`
- Azure App Registration: `https://{slug}.propreneur.uk/vical/calendar/microsoft/callback`

## Sync service (`VcalCalendarSyncService`)

Key methods:

| Method | Action |
|--------|--------|
| `createExternalEvent(VcalBooking)` | Creates event in all active connections for the booking's host |
| `updateExternalEvent(VcalBooking)` | Updates existing event by stored `external_event_id` |
| `deleteExternalEvent(VcalBooking)` | Cancels/deletes event |
| `syncAllPending()` | Processes the `vcal_booking_calendar_events` queue |
| `refreshTokenIfNeeded(connection)` | Auto-refreshes expired tokens before API calls |
| `listCalendars(connection)` | Returns calendar list for the UI picker |
| `disconnect(connection)` | Revokes token and marks connection inactive |

## Queue jobs

`SyncVcalBookingToCalendarJob` - dispatched by `VcalCalendarSyncDispatcher` on booking lifecycle events. Job handles create/update/delete based on `$action` parameter.

## Scheduler

```php
Schedule::command('vcal:calendar-sync')
    ->everyFiveMinutes()
    ->withoutOverlapping();
```

Processes pending `vcal_booking_calendar_events` rows that failed or were queued for retry.

## viCal hub UI

Calendar sync section appears in `/vical` hub when `vcal_calendar_sync` flag is enabled. Shows:
- Connected calendars per user
- Connect Google / Connect Outlook buttons
- Active calendar picker (dropdown of available calendars)
- Disconnect option

## Feature flag

`vcal_calendar_sync` - off by default. Enable per-workspace via platform admin Feature Flags. Requires `GOOGLE_CALENDAR_*` and/or `MICROSOFT_CALENDAR_*` env vars to be set on the server.

## Tests

`tests/Feature/Vcal/VcalCalendarSyncTest.php` - 4 passing: OAuth initiation, token exchange, event create/update/delete, pending sync processing.
