# 02: Availability, slots, locks, busy readers

**Status: COMPLETED 2026-08-04**

## What was built

- Slot engine, locks, busy union helpers + Vitest.
**Priority:** P0
**Depends on:** 01
**Unlocks:** 03, 04, 05, 08

## Goal

Implement slot generation and race-safe holds matching Propreneur `VcalSlotService` + `VcalSlotLockService` + busy readers, integrated with **existing** Google Calendar free/busy (and local confirmed bookings).

## Reuse first

- Propreneur: `app/Services/Vcal/VcalSlotService.php`, `VcalSlotLockService.php`, `VcalExternalCalendarBusyReader.php`.
- Core outreach: `src/outreach/bookings.ts` (`offerSlots` overlap logic, windows, buffer, horizon); replace later, learn constraints now.
- Tools: `google-calendar-list` with timeMin/timeMax.
- Cloud: calendar connection grant checks.

## Requirements

1. **Availability rules:** weekly day windows in a named timezone (default `Europe/London`).
2. **Blackouts:** date or range exclusions.
3. **Slot algorithm:**
   - Step 15 minutes (configurable later; match Propreneur).
   - Duration from event type.
   - Apply buffer before/after against existing `confirmed` / `pending_review` / `pending_payment` bookings (policy: pending_payment holds the slot).
   - Subtract lock rows not yet expired.
   - Subtract external busy (Google primary calendar events; CalDAV if already connected).
   - Honour min notice and horizon on event type / config.
4. **Offer API shape:** return next N free starts (default 5) within horizon (default 7-14 days), ISO timestamps + timezone label.
5. **Locks:** short TTL (e.g. 2-5 minutes) acquired before final create; prune expired via job or on read.
6. **Conflict errors:** structured `slot_unavailable` with alternative slots when possible (parity with outreach conflict messaging).
7. Vitest: evening-only windows, buffer collisions, lock races (two acquires), busy overlap.

## Integration with existing booking system

- Busy reader must include: Google events + existing `vcal_bookings` + temporary locks.
- Until 08 lands, also treat outreach JSON confirmed bookings as busy when adapter is wired (or migrate early for the test workspace only). Avoid double booking across the two stores during transition.

## Acceptance criteria

- [ ] Outside configured windows never offered.
- [ ] Two concurrent holds cannot both win the same start without one failing.
- [ ] Busy Google event blocks the slot when Calendar is connected.
- [ ] Disconnected Calendar still works using local rules + local bookings only (document degraded mode).

## Example agent / API uses

- "Offer five evening discovery slots next week"
- `GET /api/vcal/public/{slug}/slots?eventTypeId=...`
