# 09: Reminders, notifications, webhooks, outcomes

**Status: COMPLETED 2026-08-04**

## What was built

- viCal reminder store + process-due; lifecycle webhooks `vical.booking.*`; ICS formatter; side-effects registration.
**Priority:** P1
**Depends on:** 03, 08 (for outreach reminder parity)
**Unlocks:** funnel 07 Done When; host/guest reliability

## Goal

Ship reminder + notification side effects and outbound webhooks comparable to Propreneur viCal, wired to worker-automation / existing mail paths, and keep outreach reminder offsets working after migration.

## Reuse first

- Propreneur: `VcalBookingNotifier`, `VcalBookingReminderService`, artisan `vcal:send-booking-reminders`, mail under `app/Mail/Vcal/`, webhook events `vical.booking.*` in integrations config.
- Core: `src/outreach/reminders.ts`, `follow-ups.ts`, email send/approval paths, Telegram owner alerts where funnel already uses them.
- Funnel prompt 07 requirements (1 day + ~30-50 min reminders).

## Requirements

1. On confirm: guest + host confirmation messages (email minimum); include Meet/Zoom link and manage URL (token cancel/reschedule).
2. Schedule reminders at configurable offsets (default 1440 and 30|60 minutes); store schedule rows DB-backed (not only JSON).
3. Worker/job to send due reminders; cancel schedules on cancel/reschedule (reschedule recreates).
4. Owner alert on book / cancel / no-show (reuse Telegram/web alert helpers from outreach).
5. Outbound webhooks (workspace-configurable URL): at least `vical.booking.created`, `confirmed`, `cancelled`, `rescheduled`, `outcome` (names may match Propreneur for ecosystem consistency).
6. ICS attachment or link on confirm (formatter parity with `VcalIcsFormatter` if practical).
7. Prep-video email for outreach-sourced bookings remains a funnel concern; call existing hook from confirm path.
8. Tests: reminder cancelled when booking cancelled; reschedule resets timers.

## Integration with existing booking system

- Delete JSON reminder rows writer once DB reminders work; migrate pending reminder jobs in 08/09.
- Funnel 07 should mark complete against this implementation.

## Acceptance criteria

- [ ] Guest receives confirmation with time + join link.
- [ ] Reminder fires in staging with shortened offsets in test config.
- [ ] Cancel suppresses future reminders.
- [ ] Optional webhook test endpoint receives signed or secret-header payload (document secret storage; no secrets in repo).

## Example owner utterances

- "Remind me and the guest one day before"
- "Mark the call as no-show and follow up"
