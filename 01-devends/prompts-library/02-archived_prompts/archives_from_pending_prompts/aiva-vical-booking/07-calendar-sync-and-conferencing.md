# 07: External calendar sync and conferencing

**Status: COMPLETED 2026-08-04**

## What was built

- `calendar-sync.ts` soft-fail Google create/update/delete; outreach confirm books first then syncs; Meet/Zoom fixed room; Teams skip.
**Priority:** P0 for Google Meet path; P1 for Outlook/Teams
**Depends on:** 03, existing Calendar OAuth
**Unlocks:** trustworthy dual calendar, funnel Zoom/Meet parity

## Goal

On booking confirm (and reschedule/cancel), push/update/delete events on the host's connected Google Calendar (and Microsoft when available), attach Meet/Zoom/Teams links using adapters inspired by Propreneur conferencing + sync services, reusing Aiva's existing Calendar connection rather than a parallel OAuth app when possible.

## Reuse first

- Propreneur: `VcalCalendarSyncService`, `VcalCalendarSyncDispatcher`, `VcalOutlookCalendarService`, `VcalZoomMeetingService`, `Conferencing/*`, knowledge `141-vcal-external-calendar-sync.md`.
- Core: `google-calendar-create` / `update`, google-driver, outreach confirm Meet/Zoom logic in `bookings.ts`.
- Cloud: `calendar_connections`, Google OAuth routes under `/api/calendar/`.

## Requirements

1. **On confirm:** create calendar event with guest as attendee; store provider event id on booking.
2. **On reschedule:** update event times; refresh Meet link if provider requires.
3. **On cancel:** delete or cancel remote event.
4. **Meeting modes** (config on event type or workspace): `google_meet`, `zoom_fixed_room`, `zoom_api` (if Zoom connected), `teams`, `phone`, `in_person`, `none`.
5. Prefer Google Meet via Calendar `conferenceData` when mode is Meet.
6. Zoom: reuse existing integration patterns; fixed room URL from workspace config is acceptable P0 (outreach already does this).
7. Busy reader (02) must see these events (avoid feedback loops: ignore events tagged as originating from viCal if double-count risk; Propreneur approach: track mapping table).
8. Mapping table optional: `vcal_booking_calendar_events` (booking_id, provider, external_id).
9. Failure mode: booking remains confirmed locally; surface sync failure to host (notification or hub badge); do not roll back booking silently into unbooked.
10. Microsoft Graph path: implement when MS calendar connection exists; otherwise stub interface + skip tests marked pending.

## Integration with existing booking system

- Outreach confirm must stop creating ad-hoc Google events separately once this prompt + 08 land; one writer path only.
- Workspace Calendar sync jobs should not create duplicate local `calendar_events` rows for the same booking unless product explicitly wants a local mirror; prefer single source (Google mirror OR local row with external id).

## Acceptance criteria

- [ ] Confirmed booking appears on connected Google Calendar with guest invited.
- [ ] Cancel removes or cancels the remote event.
- [ ] Meet or Zoom join details present on booking + guest-facing message path.
- [ ] Sync failure does not unconfirm the booking; host can see error state.

## Example owner utterances

- "Connect Google Calendar for booking" (existing settings)
- "Use Google Meet on discovery bookings"
