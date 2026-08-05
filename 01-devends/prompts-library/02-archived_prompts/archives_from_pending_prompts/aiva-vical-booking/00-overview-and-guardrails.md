# 00: Overview and guardrails (adopt viCal into Carina / Aiva)

**Status: COMPLETED 2026-08-04**

## What was built

- Guardrails and source map for adopting Propreneur viCal into Carina/Aiva.
**Depends on:** none
**Unlocks:** 01-12

## Context for the agent

**viCal** = Verlox Integrated Calendar. Product label in UI: `viCal`. Billing / feature key in Propreneur: `booking_calendar`. PHP/DB: `Vcal` / `vcal_*`. Paths/Blade: `/vical`, `/book/{slug}`.

Propreneur-v2 already ships a Calendly-class engine: event types, availability rules, blackouts, public book + embed, intake pools, approval, Stripe deposits, round-robin hosts, Zoom/Meet/Teams, Google + Microsoft calendar sync, reminders, webhooks, CRM/Carina hooks.

Carina/Aiva today:

| Layer | What exists | Gap |
|---|---|---|
| Workspace Calendar UI | Month/week/agenda + Google/CalDAV sync + local events | Not a multi event-type booking product |
| Agent Google Calendar tools | list / create / update (primary calendar) | Busy hint only; not a booking catalog |
| Outreach booking | `src/outreach/bookings.ts` + `outreach-booking-*` tools; JSON store | Single discovery config; file-backed; no public book parity |

**Adoption goal:** Port viCal **behaviour** into the Carina TS platform so Aiva (and later other surfaces) use one workspace-scoped booking engine, then **point the existing outreach booking tools/UI at that engine**.

## Naming on the TS platform

Prefer product-facing **viCal** / route prefix **`/book`** and **`/vical`** (or `/booking`) for host hub. Internal modules may use `vcal` or `booking` consistently:

Suggested Core package:

```
carina/02-backends/core.carinaai.uk/src/vcal/
  types.ts
  store/ or repos against Postgres (prefer Drizzle via cloud; Core may call cloud API)
  slots.ts
  bookings.ts
  availability.ts
  sync/
  conferencing/
  notifications/
```

Cloud / Hire Aiva app:

```
carina/03-frontends/client-apps/app.carinaai.uk/
  src/app/(workspace)/vical/...   # host hub
  src/app/book/[slug]/...         # public guest (or dedicated public layout)
  src/db/schema.ts                # vcal_* tables workspace-scoped
  src/app/api/vcal/...            # REST
```

Exact folder names may match existing layout conventions in Core/cloud; do not invent a second runtime.

## Soft separation

- **Shared engine, schemas, APIs, agent tools** → Carina Core (+ cloud DB/API as today for workspace data).
- **Hire Aiva branding, nav labels, onboarding CTAs, pricing entitlements** → Aiva product surface.
- Reference: `shared/workspace-governance/CARINA-AIVA-SOFT-SEPARATION.md`.

## Integration contract with existing booking

After prompts 01-04 and 08:

1. `outreach-booking-offer-slots` / `confirm` / `reschedule` / `cancel` call the **viCal** slot + booking services (or thin adapters), not a separate free/busy invent.
2. Outreach `BookingConfig` maps onto a default **event type** (or workspace default windows) plus blackouts.
3. Confirmed outreach bookings are rows in `vcal_bookings` (or equivalent) with `source=outreach` / `kind=discovery`, and still update Kanban / lead status as today.
4. Workspace Calendar page continues to show Google sync + local events; confirmed viCal bookings either sync as Google events (existing path) or also appear as first-class local calendar items without double-writing races.
5. Funnel prompts 05/07 must not reimplement slots once this programme lands; they depend on it.

## Behavioural reference checklist (from propreneur-v2)

Port these capabilities in phases (not all day one):

1. Event types (duration, buffers, min notice, horizon, location mode, approval flag, deposit flag).
2. Weekly availability rules + blackout dates.
3. Slot generation (15-min step) minus bookings, buffers, blackouts, external busy.
4. Slot locks during book race.
5. Booking statuses: `pending_payment`, `pending_review`, `confirmed`, `cancelled`, `rejected`; outcomes `attended` / `no_show`.
6. Guest create, guest cancel/reschedule by token, host approve/reject/cancel/reschedule.
7. Public `/book/{slug}`, embed, optional signed embed.
8. Confirmations + ICS; reminders 24h / ~1h (configurable).
9. Conferencing adapters + calendar push (Google first; Microsoft when OAuth exists).
10. Outbound lifecycle webhooks (`vical.booking.*` naming may stay for product consistency).
11. Intake pools + routing (phase 10).
12. Deposits via Stripe Checkout using **existing** price IDs from `/opt/lampp/htdocs/verlox/.access/.stripe-credentials-and-price-id.md` only (phase 11; owner gate).

## Technical guardrails

1. Never create `carina/verlox/` nests. Run `bash /opt/lampp/htdocs/verlox/scripts/guard-forbidden-carina-nests.sh` if unsure.
2. Writing style: no em dashes (U+2014), no en dashes (U+2013), no emojis in first-party copy. Scan with `python3 /opt/lampp/htdocs/verlox/scripts/fix-writing-style.py` on touched files.
3. Prefer Core + `app.carinaai.uk` paths Aiva already uses; no parallel agent OS.
4. Do not grant Aiva workers `shell-exec` to curl Google/MS.
5. Secrets stay in `/opt/lampp/htdocs/verlox/.access/` and VPS env. Never paste secrets into prompts, commits, or chat.
6. Stripe: never create new prices unless the owner explicitly asks. Read labels/IDs only as needed.
7. Tests: Vitest for Core; Feature-style tests for cloud API/DB; manual smoke in prompt 12.
8. Multi-workspace isolation is mandatory (same bar as other cloud tables).
9. Reuse Google Calendar connectors already in Core / cloud; do not invent a third OAuth client without reason.
10. Propreneur Laravel remains authoritative for **property / mentoring** anchors (CRM FKs, learning paths). On Aiva, map anchors to Contacts / outreach leads / Documents where those exist; do not drag Propreneur tenant PHP models into Core.

## Architecture target

```
Guest (/book/{slug} or agent offer)
  -> Public / agent API
  -> VcalBookingService (TS)
       + VcalSlotService + SlotLock
       + BusyReader (Google / MS / local confirmed)
       + Conferencing + CalendarSync
  -> Postgres vcal_* (workspace_id)
  -> Mail/SMS/webhook/reminders
  -> Workspace Calendar + Google event (when connected)

Host hub (/vical)
  -> CRUD event types, rules, blackouts, bookings, analytics

Outreach tools
  -> adapters over same VcalBookingService (prompt 08)
```

## Out of scope for this programme

- Group events / ticketing / mentor directory (Propreneur-specific; later programme).
- Full accounting deposit journals / Comms Hub sequence enrollment (Propreneur modules).
- Replacing Propreneur's Laravel viCal.
- Keprix migrate.

## When finished with any later prompt

1. Run relevant Vitest / cloud tests.
2. Fix writing style on touched copy.
3. Tick parent README checkboxes.
4. Archive completed prompts per POST-BUILD-CHECKLIST (do not leave Done work in pending).
