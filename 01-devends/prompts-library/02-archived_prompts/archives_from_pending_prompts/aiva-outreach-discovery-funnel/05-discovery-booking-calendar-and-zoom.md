# 05: Discovery booking (Calendar + Zoom)

**Status:** PENDING
**Priority:** P0
**Depends on:** 01, 04; **`aiva-vical-booking` 08 cutover COMPLETED 2026-08-04** (merged engine: viCal slots + outreach mirror)
**Unlocks:** 06, 07, 08

## Goal

Interested prospects book a discovery Zoom into Jak's existing Google Calendar without colliding slots, respecting evening / strict availability, and alerting Jak when booked.

## Programme note

Canonical booking adoption lives in `aiva-vical-booking/` (08 archived under `archives_from_pending_prompts/aiva-vical-booking/`). Implement this prompt as a thin funnel consumer (config, alerts, Meet/Zoom mode via remaining viCal 07). Do not invent a second booking store. Outreach tools already create viCal rows when `VICAL_OUTREACH_BACKEND=vical` (default).

## Why

High-ticket SEO (£3k-£6k) needs a discovery call, not fulfillment in email. Double-booking destroys trust.

## Reuse first

- `google-calendar-list` (busy lookup with timeMin/timeMax)
- `google-calendar-create` / `google-calendar-update`
- Workspace Calendar page (`/calendar`)
- Meet/Zoom: prefer Google Meet link on create if Calendar supports conferenceData; else paste Jak’s fixed Zoom room from config Document
- Public booking: build only if chat-time offer is not enough for pilot (P0 chat offer + hold; P1 public booking page)

## Requirements

1. Availability config (workspace):
   - timezone `Europe/London` default
   - weekly windows (e.g. evenings only for Jak)
   - slot length (30 or 45 min)
   - buffer minutes between meetings
   - blocked dates / "busy override"
2. Offer slots by email or chat: next 5 free starts within next 7-14 days.
3. On accept (reply with chosen slot OR booking form):
   - re-check free/busy (avoid race)
   - create Calendar event with prospect email as attendee
   - add Meet or Zoom join details in description/location
   - set sheet `status=booked`; Kanban move (08)
   - alert owner immediately (11)
4. Reject conflicts with clear "that slot just filled; here are alternatives".
5. Store `event_id` on sheet/Kanban card for reminders (07).
6. Tests for free/busy selection and conflict rejection.

## Acceptance criteria

- [ ] Two clients cannot book the same start time.
- [ ] Outside evening windows never offered when config is evening-only.
- [ ] Owner gets an alert containing prospect name, time, and Meet/Zoom link.
- [ ] Calendar event appears on the connected Google Calendar Jak already uses.

## Deploy

Core booking helpers; cloud public page only if implemented in this prompt (recommend chat-first for week 1).
