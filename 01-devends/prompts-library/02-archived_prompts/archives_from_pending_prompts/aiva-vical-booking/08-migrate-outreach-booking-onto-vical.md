# 08: Migrate outreach discovery booking onto viCal

**Status: COMPLETED 2026-08-04**
**Priority:** P0 (integration with existing booking system)
**Depends on:** 01-04, ideally 07 for Meet/Zoom parity
**Unlocks:** single engine for funnel prompts 05/07; retire JSON booking SoT

## What was built

- Merged engine: viCal owns slots/locks/booking rows; outreach JSON mirrors for Kanban, reminders, Soft Wall.
- Flag `VICAL_OUTREACH_BACKEND=vical|legacy` (default `vical`; `legacy` = break-glass JSON-only).
- Core: `src/outreach/vical-cutover.ts`, `src/vical/outreach-adapter.ts`, facades in `src/outreach/bookings.ts`.
- API: `GET /booking-engine`, `POST /booking-engine/backfill` on `aiva-outreach-api`.
- Tests: `src/outreach/vical-cutover.test.ts` + funnel booking tests green (15 with vical suite).
- Outreach `kanban.ts` dynamic-imports native board service to avoid SubAgent circular init in Vitest.

## Goal

Make the **existing** outreach booking system (`src/outreach/bookings.ts`, `outreach-booking-tools.ts`, outreach API, Kanban/reminder hooks) a **consumer** of viCal, not a second calendar. Preserve tool names and funnel behaviour for Jakstar / Hire Aiva pilots.

## Reuse first

- Current MVP: `src/outreach/bookings.ts`, `types.ts` (`BookingConfig`, `OutreachBooking`), `reminders.ts`, `follow-ups.ts`, `kanban.ts`, `api/aiva-outreach-api.ts`.
- Pending funnel: `aiva-outreach-discovery-funnel/05-discovery-booking-calendar-and-zoom.md`, `07-appointment-reminders-and-reschedule.md`.
- Archived baseline: `archives_from_pending_prompts/09-outreach-funnel/o04-booking-calendar-integration.md`.

## Requirements

1. **Config mapping:**
   - `BookingConfig.windows` / buffers / horizon / timezone ↔ `vcal_availability_rules` + default discovery `vcal_event_types` row per workspace.
   - `updateBookingConfig` writes through to viCal rules (or dual-writes briefly then single-writes).
2. **CRUD mapping:**
   - `offerSlots` → `VcalSlotService`.
   - `confirmBooking` → `VcalBookingService.create*` with `source=outreach`, `leadId` set; then existing lead status / Kanban / prep-video email hooks.
   - reschedule/cancel → viCal lifecycle + keep outreach side effects.
3. **Data migration:**
   - One-shot: copy active outreach JSON bookings into `vcal_bookings` for workspaces; keep ids map or store `outreach_booking_id` in metadata.
   - Feature flag `VICAL_OUTREACH_BACKEND=vical|legacy` for safe cutover.
4. **Single free/busy:** during transition, busy reader unions both stores; after cutover, JSON bookings become read-only archive.
5. **API compatibility:** `aiva-outreach-api` booking endpoints keep URLs; swap internals.
6. **Tools:** `outreach-booking-*` remain; implementations delegate to viCal (aliases from 04).
7. **Tests:** funnel conflict tests retargeted; regression that Kanban still moves on book.
8. Update funnel prompt 05/07 text in a short note at top: "Depends on aiva-vical-booking 08" (do not rewrite entire funnel set unless needed).

## Acceptance criteria

- [x] Confirming a discovery slot via existing tools creates a `vcal_bookings` row and updates lead/Kanban as before.
- [x] Two funnel clients cannot book the same start (lock + engine).
- [x] Flag flip to legacy still works until owner removes flag (or documented break glass).
- [ ] No second Google event writer path remaining when 07 is done.
- [x] JSON store is no longer the source of truth for new bookings after cutover.

## Cutover steps (implementer must document in 12)

1. Deploy schema + services.
2. Backfill.
3. Enable flag on staging workspace.
4. Smoke Jakstar.
5. Default flag to vical.
6. Remove legacy write path in a follow-up PR (may be same prompt if safe).
