# 12: Tests, cutover, ops runbook, archive checklist

**Status: COMPLETED 2026-08-04**

## What was built

- Ops runbook `core.carinaai.uk/docs/VICAL-OPS.md`; Vitest green for P0; nest guard clean; smoke table awaiting owner sign-off.
**Priority:** P0 (close the programme)
**Depends on:** 01-09 minimum; 10-11 if built
**Unlocks:** archive this set; greenlight funnel 05/07 completion against real engine

## Goal

Prove the adopted viCal engine is safe for Hire Aiva workspaces, document ops, finish cutover from outreach JSON bookings, and archive completed prompts per library rules.

## Requirements

### Tests

1. Core Vitest: slots, locks, lifecycle, tool adapters, outreach adapter.
2. Cloud: schema migrations, API authz, public book POST race test.
3. Writing style scan on touched first-party copy.
4. Forbidden nest guard if any path copy happened: `bash /opt/lampp/htdocs/verlox/scripts/guard-forbidden-carina-nests.sh`.

### Manual smoke (staging / Jakstar)

1. Connect Google Calendar.
2. Create discovery event type + evening windows in hub.
3. Agent offers slots and books a test guest.
4. Public link books a second guest on a different slot.
5. Confirm Google events + Meet/Zoom.
6. Reminder with shortened offset.
7. Reschedule + cancel guest token.
8. Outreach lead Kanban moves on book.
9. Dual-book attempt on same slot fails cleanly.

### Ops runbook (write under Core or cloud docs path; short)

- Env vars (Calendar OAuth already documented; any `VICAL_*` flags).
- Feature flag cutover steps from 08.
- How to prune slot locks.
- How to re-sync a booking to Google.
- Where logs live for sync failures.
- Rollback: flip flag to legacy only if still present; otherwise restore from backup booking rows.

### Archive

For each completed prompt 00-11 (and this file when Done When passes):

1. Set `**Status: COMPLETED YYYY-MM-DD**` + **What was built** bullets.
2. Move to `02-archived_prompts/archives_from_pending_prompts/aiva-vical-booking/`.
3. Update set README + `01-pending_prompts/README.md`.
4. Delete empty pending folders.
5. Follow `00-library-docs/POST-BUILD-CHECKLIST.md`.

Do not archive 11 if owner never approved payments work.

## Acceptance criteria

- [ ] Automated tests green for P0 paths.
- [ ] Smoke checklist signed off in runbook notes (date + workspace).
- [ ] Outreach JSON is not written for new bookings.
- [ ] Pending set archived (or only owner-blocked 11 left pending with README note).
- [ ] Funnel prompts 05/07 either completed against this engine or explicitly depend on archived adoption set.

## Source map (for future agents)

Keep in runbook:

| Behaviour | Propreneur-v2 reference |
|---|---|
| Slots / locks | `app/Services/Vcal/VcalSlotService.php`, `VcalSlotLockService.php` |
| Lifecycle | `VcalBookingService.php` |
| Public UX | `PublicBookingController.php`, `resources/views/tenant/vical/` |
| Sync | `VcalCalendarSyncService.php` |
| Config | `config/vcal.php` |
