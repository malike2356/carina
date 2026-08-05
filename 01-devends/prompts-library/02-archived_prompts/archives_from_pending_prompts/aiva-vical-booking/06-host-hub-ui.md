# 06: Host hub UI (viCal admin)

**Status: COMPLETED 2026-08-04**

## What was built

- Host hub `/vical` pages + Core proxy.
**Priority:** P1
**Depends on:** 04
**Unlocks:** non-agent configuration, analytics baseline

## Goal

Give workspace hosts a `/vical` (or `/booking`) hub to manage event types, availability, blackouts, bookings, calendar views, and embed/API helper copy, integrating navigation with the existing Workspace Calendar settings (do not invent a second Google connect flow).

## Reuse first

- Propreneur hub: `resources/views/tenant/vical/` + `VicalController`, calendar/analytics blades.
- Aiva Calendar: `(workspace)/calendar/page.tsx`, `settings/calendar`, `CalendarConnectionPanel`.
- Soft separation: Aiva branding on Hire Aiva routes; shared components OK in design system folders if they exist.

## Requirements

1. Nav entry for viCal / Bookings under workspace chrome (Hire Aiva label OK).
2. Pages:
   - Hub index: upcoming, pending approvals banner, quick links
   - Event types CRUD
   - Availability weekly grid + blackouts
   - Bookings show: approve/reject/cancel/reschedule/notes/outcome
   - Calendar day/week/month of bookings (can deep-link to `/calendar` for Google layer; this view is booking-centric)
   - Developer/embed disclosure: public URL, embed iframe snippet, regenerate publish secret if implemented
3. Pending review queue actionable from banner.
4. Link to existing Calendar connection settings when sync needed ("Connect Google Calendar").
5. Empty states that teach first event type + windows (not blank).
6. Do not redesign the whole app shell; match existing workspace UI patterns.

## Integration with existing booking system

- Hub lists bookings from Postgres viCal tables, including `source=outreach` after 08.
- Workspace `/calendar` continues to show synced Google + local notes; document relationship in empty-state help one-liner.

## Acceptance criteria

- [ ] Host can create an event type and weekly windows without using chat.
- [ ] Pending booking can be approved from hub and guest status flips to confirmed.
- [ ] Public book slug shown and copyable.
- [ ] No second OAuth connect panel duplicated; reuses settings/calendar.

## Example owner utterances (still work via tools)

- "Open my booking hub settings" (optional deep link tool later; not required)
