# viCal ops runbook (Carina Core / Hire Aiva)

**Updated:** 2026-08-04

## What is live

- Core engine: `core.carinaai.uk/src/vical/`
- HTTP: `/api/aiva/vical/*` (cloud proxy)
- Outreach consumer: `/api/aiva/outreach/*` with merged booking engine
- Public + hub UI: `app.carinaai.uk` `/book/[slug]`, `/vical`

## Env vars

| Var | Default | Meaning |
| --- | --- | --- |
| `VICAL_OUTREACH_BACKEND` | `vical` | `vical` = viCal SoT + outreach mirror; `legacy` = JSON-only break-glass |
| `VICAL_OUTREACH_HOST_USER_ID` | `outreach-host` | Host user id used when seeding discovery event type / rules |
| `CARINA_HOME` | `~/.carina` | File store root (`vical/vical-store.json`, outreach JSON) |

Calendar OAuth remains the existing Google Calendar / tools connect flow (no separate viCal OAuth app).

Webhook secrets stay in the Core webhook subscription store (HMAC `X-Carina-Signature`). Do not commit secrets.

## Cutover (from prompt 08)

1. Deploy Core with viCal store + Cloud `vcal_*` migration when ready.
2. Backfill: `POST /api/aiva/outreach/booking-engine/backfill` (workspace header).
3. Confirm `GET /api/aiva/outreach/booking-engine` → `backend: vical`.
4. Smoke Jakstar / Hire Aiva (checklist below).
5. Keep `legacy` available only as break-glass; prefer fix-forward.

Rollback: set `VICAL_OUTREACH_BACKEND=legacy` only while legacy write path still exists.

## Calendar sync

- Writer: `src/vical/calendar-sync.ts` via `invokeProductTool` Google Calendar create/update/**delete**.
- Outreach confirm books **first**, then soft-syncs. Sync failure leaves booking **confirmed** and sets `calendarSyncStatus=failed` + `calendarSyncError`.
- Re-sync: `POST /api/aiva/vical/bookings/:id/calendar-sync` with `workerId` (body or `x-worker-id`).
- Microsoft/Teams: skipped with warning until MS connection exists.

## Reminders + webhooks

- viCal reminder rows: store `reminders[]`; schedule on confirm/reschedule; cancel on cancel.
- Process: `POST /api/aiva/vical/reminders/process-due`
- Outreach Soft Wall reminders still schedule on the mirror path for Kanban/email continuity.
- Outbound events: `vical.booking.created|confirmed|cancelled|rescheduled|outcome` (HMAC signed when subscription has secret).

## Locks + ICS

- Prune locks: `pruneExpiredLocks()` (Core) or wait for TTL.
- ICS: `GET /api/aiva/vical/bookings/:id/ics`

## Logs / failure surface

- Sync errors on booking: `calendarSyncStatus`, `calendarSyncError`.
- Hub should treat failed sync as a badge, never as unbooked.

## Manual smoke checklist

| # | Check | Result (date / workspace) |
| --- | --- | --- |
| 1 | Connect Google Calendar | |
| 2 | Discovery event type + evening windows in `/vical` | |
| 3 | Agent offers slots and books a test guest | |
| 4 | Public `/book/{slug}` books another slot | |
| 5 | Google event + Meet/Zoom on booking | |
| 6 | Reminder with shortened offsets in test | |
| 7 | Guest token reschedule + cancel | |
| 8 | Outreach lead Kanban moves on book | |
| 9 | Dual-book same start fails | |

Smoke sign-off: _pending owner staging run_

## Source map (Propreneur reference)

| Behaviour | Propreneur-v2 |
| --- | --- |
| Slots / locks | `app/Services/Vcal/VcalSlotService.php`, `VcalSlotLockService.php` |
| Lifecycle | `VcalBookingService.php` |
| Public UX | `PublicBookingController.php`, `resources/views/tenant/vical/` |
| Sync | `VcalCalendarSyncService.php` |
| Config | `config/vcal.php` |

Canonical Carina trees only: `02-backends/`, `03-frontends/`, `scripts/`. Never nest `carina/verlox/`.
