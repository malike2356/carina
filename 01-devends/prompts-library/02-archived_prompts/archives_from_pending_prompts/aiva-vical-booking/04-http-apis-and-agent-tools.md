# 04: HTTP APIs and Aiva agent tools

**Status: COMPLETED 2026-08-04**

## What was built

- `/api/aiva/vical` + `vical-*` tools; outreach tools remain.
**Priority:** P0
**Depends on:** 03
**Unlocks:** 05, 06, 08, funnel 05/07 consumers

## Goal

Expose viCal via cloud REST (public + authenticated) and register Aiva agent tools so chat/Telegram can list event types, offer slots, book, reschedule, cancel, and list upcoming sessions, while remaining compatible with existing `outreach-booking-*` tool names during migration.

## Reuse first

- Propreneur routes: `routes/tenant_vcal_api.php`, public `/api/vcal/public/{slug}/...`, `PublicVcalApiController`, `Api/Vcal/*`.
- Propreneur Carina tools: `ListVcalEventTypesTool`, `CheckVcalAvailabilityTool`, `ScheduleSessionTool`, `VcalBookingToolHandler`.
- Core: `src/tools/outreach-booking-tools.ts`, `product-tool-adapters.ts`, tool grant UX patterns from Companies House / Gmail adapters.
- Cloud: existing `/api/calendar/*` auth patterns.

## Requirements

### A) HTTP APIs (cloud)

Authenticated (session / workspace member):

- CRUD-ish: event-types, availability-rules, blackouts
- Bookings: list, create (internal), approve, reject, cancel, reschedule, set outcome
- Analytics snapshot optional thin list counts

Public (slug or publish token):

- `GET event-types`, `GET slots`, `GET calendar` (availability days), `POST bookings`
- Guest: cancel / reschedule by token

Match response shapes closely enough that Propreneur public clients are conceptually portable; do not require byte-identical payloads.

### B) Agent tools (Core)

Register (names suggested; keep kebab-case product style):

| Tool | Purpose |
|---|---|
| `vical-event-types-list` | List active event types |
| `vical-slots-offer` | Offer free slots for event type / default discovery |
| `vical-booking-create` | Create booking (danger + confirm when policy requires) |
| `vical-booking-list` | Upcoming / filter by email or lead |
| `vical-booking-cancel` | Cancel by id |
| `vical-booking-reschedule` | Reschedule by id |
| `vical-booking-config-get` / `update` | Host windows (or map to availability rules) |

Until prompt 08 completes, either:

- implement these as the new canonical tools and make `outreach-booking-*` thin aliases, or
- keep `outreach-booking-*` as the public tool names and back them with viCal services.

Document the chosen alias strategy in code comments + README tick.

### C) Grants / configure

- Tools appear in Tools UI with honest "connect Calendar" CTA when busy reading needs Google.
- Missing Calendar must not blank-reply; degraded local-only slots OK when rules exist.

### D) Tests

Vitest for tool param mapping; API route tests for authz (cross-workspace 404/403).

## Acceptance criteria

- [ ] Authenticated member can list and create event types via API.
- [ ] Public slug can fetch slots and create a booking without session cookie tricks leaking host data.
- [ ] Aiva with grant: "offer discovery slots next week" returns real computed slots.
- [ ] Cancel/reschedule tools mutate DB and free/block slots correctly.
- [ ] Existing outreach utterances still work via aliases or unchanged tool names.

## Example owner utterances

- "What booking types do we offer?"
- "Offer Anna three evening slots for a discovery call"
- "Book the 18:30 Thursday slot for anna@example.com"
- "Reschedule that booking to Friday 19:00"
- "List my confirmed bookings this week"
