# 03: Booking lifecycle service

**Status: COMPLETED 2026-08-04**

## What was built

- Create / approve / reject / cancel / reschedule + hooks.
**Priority:** P0
**Depends on:** 02
**Unlocks:** 04, 05, 06, 08, 09

## Goal

Port Propreneur `VcalBookingService` create / approve / reject / cancel / reschedule / outcome flows into TypeScript, workspace-scoped, with clear status machine and side-effect hooks (notifications deferred to 09; conferencing/sync hooks stubbed for 07).

## Reuse first

- Propreneur: `app/Services/Vcal/VcalBookingService.php` (public + internal create), notifier side effects as optional interfaces.
- Outreach: confirm/reschedule/cancel in `src/outreach/bookings.ts` (behaviour to preserve for discovery: attendee email, Meet/Zoom, reminders schedule calls).
- Guest token URLs pattern from `PublicBookingController`.

## Requirements

1. **createPublicBooking** (and internal/agent variant):
   - Validate event type active + belongs to workspace.
   - Optional intake stub (full intake in 10): if missing, skip.
   - Resolve host (single host P0; round-robin stub interface for later).
   - Assert slot free; acquire lock; transaction insert booking.
   - Status:
     - `pending_payment` if deposit required (only if 11 enabled; else ignore flag).
     - `pending_review` if requires_approval.
     - else `confirmed`.
   - Generate opaque `guest_token` for cancel/reschedule/ICS.
   - Emit domain hook: `booking.created`.
2. **approve** / **reject** (host): only from `pending_review`.
3. **cancel** host and guest (guest needs token + policy window).
4. **reschedule** host and guest: re-check slot; update times; emit `booking.rescheduled` with previous start/end.
5. **setSessionOutcome** `attended` | `no_show`.
6. Idempotent-ish behaviour on duplicate guest submit same slot (explicit conflict vs upsert policy; match Propreneur: reject conflict).
7. Never leak other workspaces' bookings in list filters.
8. Unit tests for each transition; illegal transitions throw typed errors.

## Integration with existing booking system

- Provide adapter methods used by prompt 08:
  - `createFromOutreach({ leadId, email, name, startsAt, eventTypeId? })`
  - Map outreach statuses onto viCal statuses.
- Keep method names consumable by `outreach-booking-tools.ts` without breaking tool schemas (shim layer OK).

## Acceptance criteria

- [ ] Happy path public create → `confirmed` with token.
- [ ] Approval-required type stays `pending_review` until approve → `confirmed`.
- [ ] Guest cancel by token works; invalid token fails closed.
- [ ] Reschedule moves time and frees old slot for others.
- [ ] No-show / attended recorded without deleting history.

## Example owner utterances (tools land in 04)

- "Book Anna at Thursday 18:30 for discovery"
- "Cancel the booking with Anna next Thursday"
- "Mark yesterday's discovery as no-show"
