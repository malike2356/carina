# 07: Appointment reminders and reschedule

**Status:** PENDING
**Priority:** P0
**Depends on:** 05, 06; **`aiva-vical-booking` 08 cutover COMPLETED 2026-08-04**; prefer `aiva-vical-booking/09-reminders-notifications-webhooks.md` next
**Unlocks:** 09

## Goal

Booked prospects get reminders (about 1 day before, and about 50-30 minutes before) with an easy reschedule path so they do not ghost the discovery call.

## Programme note

viCal owns booking rows after 08; implement reminders/reschedule against viCal bookings + schedules (prompt 09). Avoid a parallel JSON-only reminder system for new bookings. Outreach JSON remains the mirror for existing Soft Wall reminder ids until 09 consolidates.

## Why

Jak explicitly wants reminder + reschedule behaviour similar to GoHighLevel workflows, inside Aiva.

## Reuse first

- `worker-automation` timed jobs or Calendar-triggered reminder worker
- `notes-manage` reminders as secondary owner nudges
- `gmail-send` for prospect reminders
- `google-calendar-update` for reschedule
- Telegram alert to owner on reschedule / cancel

## Requirements

1. Default reminder schedule (configurable):
   - T-24h email to prospect
   - T-50m or T-30m email (pick one default: T-30m; allow 50m in config)
2. Each reminder includes: time, Join link, prep video link, "reply RESCHEDULE" or booking link.
3. Reschedule flow:
   - prospect replies with new preference OR picks new slot
   - old event updated or replaced atomically
   - reminders rescheduled; Kanban note updated
4. No-show handling (after start+grace):
   - mark sheet/Kanban `no_show` or stay `booked` with label
   - enqueue follow-up (09)
   - alert owner
5. Do not spam: max reminders as configured; skip if event cancelled.
6. Tests for scheduling math in Europe/London and cancellation skip.

## Acceptance criteria

- [ ] Creating a booking schedules both reminder jobs (visible via worker-automation list or equivalent store).
- [ ] Cancelling the event prevents further prospect reminder emails.
- [ ] Reschedule moves Calendar time and owner is notified.

## Deploy

Core reminder scheduler + automation registration.
