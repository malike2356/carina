# 01: Workspace booking domain model (Postgres)

**Status: COMPLETED 2026-08-04**

## What was built

- Core file store + Cloud Drizzle `vcal_*` + migration `0005`.
**Priority:** P0
**Depends on:** 00
**Unlocks:** 02-12

## Goal

Land workspace-scoped Postgres tables and typed repos/services skeletons that mirror Propreneur `vcal_*` enough for Core + Hire Aiva to become the booking system of record (replacing long-term reliance on JSON outreach store).

## Reuse first

- Propreneur reference migrations: `/opt/lampp/htdocs/verlox/propreneur/propreneur-v2/database/migrations/tenant/` (`*vcal*` / `*vical*`), especially `2026_05_02_630000_create_vical_tables.php` and follow-ons.
- Propreneur models: `app/Models/Tenant/Vcal/*`.
- Cloud Drizzle: `carina/03-frontends/client-apps/app.carinaai.uk/src/db/schema.ts` patterns for `calendar_events`, `calendar_connections`, outreach tables.
- Soft create calendar helper: Core `src/aiva/workspace-ops/calendar.ts` (do not confuse with booking rows).

## Requirements

1. Add tables (names may use `vcal_` prefix for product consistency):

| Table | Minimum columns |
|---|---|
| `vcal_event_types` | id, workspace_id, host_user_id, slug/name, duration_minutes, buffer_before/after, min_notice_minutes, horizon_days, location_mode, requires_approval, requires_deposit (bool), deposit_minor/currency nullable, intake_pool_id nullable, active, metadata JSON, timestamps |
| `vcal_availability_rules` | id, workspace_id, host_user_id (or event_type_id if scoped), day_of_week, start_time, end_time, timezone, optional mentor/profile null on Aiva |
| `vcal_blackout_dates` | id, workspace_id, host_user_id nullable, starts_on/ends_on (or timestamptz range), reason |
| `vcal_bookings` | id, workspace_id, event_type_id, host_user_id, guest_name, guest_email, starts_at, ends_at, status, guest_token, meeting_url, calendar_event_id nullable, contact_id/lead_id nullable, source (`public`/`api`/`agent`/`outreach`), intake_answers JSON, notes, session_outcome nullable, cancel/reschedule metadata, timestamps |
| `vcal_slot_locks` | id, workspace_id, host_user_id, starts_at, ends_at, holder_token, expires_at |
| `vcal_api_keys` (optional P1) | workspace-scoped public API keys |

2. Indexes: workspace + host + time range on bookings; unique guest_token; lock expiry prune key.
3. Status enum matches Propreneur lifecycle used by prompt 03: `pending_payment`, `pending_review`, `confirmed`, `cancelled`, `rejected`.
4. Repos with workspace isolation helpers; never accept cross-workspace ids without check.
5. Seed helper: create one default "Discovery call" event type + evening windows for a workspace (maps later to outreach defaults).
6. Migration + down path (or Drizzle migrate) documented in prompt 12 runbook.
7. Do **not** delete `calendar_events` / outreach JSON yet; dual-write policy is defined in 08.

## Acceptance criteria

- [ ] Schema exists in cloud DB layer with workspace FK discipline.
- [ ] Can insert event type + rule + blackout + booking in a unit/integration test.
- [ ] Bookings query by workspace + time range is indexed/tested.
- [ ] Docs comment points agents to propreneur-v2 as behavioural source, not copy-paste PHP.

## Deploy

Cloud schema migration for `app.carinaai.uk` (or shared Postgres the app already uses). Core may remain API-client until cloud APIs exist in 04.
