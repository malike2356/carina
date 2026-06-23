# viCal - Module 10 (Booking)

**Last updated:** 2026-05-13  
**Status:** Phase 1 shipped; hub calendar (day/week/month), intake question sets, guest cancel/reschedule/ICS, analytics snapshot, group-events slice - see **`vical-implementation-status.md`** for Phases 2-7 (v1 / PropBook parity).  
**Module:** 10 (Booking)

---

## What viCal is

**viCal** (Verlox Integrated Calendar) is the in-product calendar and booking system for Propreneur v2. It replaces any prior plan to embed **Cal.com**. Booking data lives in the **tenant** database (`propreneur_t_{slug}`), not in a third-party scheduling product schema.

viCal is intentionally architected so it can be **extracted** after launch as a standalone multi-tenant SaaS (for example `vcal.verlox.co.uk` with its own tenant provisioning), while today it ships as Module 10 inside Propreneur.

---

## Why not Cal.com

- Cal.com carries its own schema, webhooks, and self-hosting surface area; embedding it pushes contacts and meetings into Cal-shaped storage instead of first-class tenant tables.
- Propreneur needs bookings **queryable in tenant context**, linkable to **contacts**, **deal_analyses**, **pipeline_deals**, and visible to **Carina** without cross-database joins to an external app.
- Verlox controls release cadence, compliance, and UX without depending on Cal.com upgrades or Docker topologies documented elsewhere for historical Cal hosting.

Operational docs under the wider monorepo `.documentations/` that referred to **cal.propreneur.uk** or **Cal.com Docker** replication are **historical** only where they still exist; **CAL_COM_REPLICATION_STEP_BY_STEP.md** is superseded for v2 build work and should be treated as deprecated reference, not an active runbook.

---

## Core scope (Propreneur)

- **Availability:** Tenant-scoped rules (working hours, buffers, blackout windows).
- **Public booking:** Per-user or team booking pages, for example `{slug}.propreneur.co.uk/book/{user}` (exact path subject to routing design).
- **Event types:** Examples include investor call, deal walkthrough, mentoring session, property viewing.
- **Communications Hub:** Automatic injection of booking links into sequences (see `31-comms-and-engagement-engine.md` for tokens such as `{{workspace.booking_link}}`).
- **CRM and deals:** Bookings linked natively to contacts, deal analyses, and pipeline deals where the product requires it.
- **Carina:** Natural language context, for example scheduled calls tied to a person and a property address.

---

## Data model (planned)

All viCal persistence is **tenant-scoped**. Use **`database/migrations/tenant/`** only. No central viCal tables are required for the default design.

Planned table names (subject to naming review during implementation):

| Table | Role |
|-------|------|
| `vcal_event_types` | Schedulable event definitions per workspace or user |
| `vcal_availability_rules` | Working hours, buffers, recurrence |
| `vcal_bookings` | Confirmed slots, attendees, links to contact or deal context |
| `vcal_blackout_dates` | Dates or ranges when booking is blocked |

Each migration must implement **`down()`**. Follow existing tenant patterns (models under `App\Models\Tenant\` or a dedicated `App\Models\Tenant\Vcal\` namespace once added).

---

## Build order (high level)

1. Tenant migrations and Eloquent models for the four tables above. **[x] 2026-05-02**  
2. Service layer under `app/Services/Vcal/`, thin controllers. **[x]**  
3. Tenant routes in `routes/tenant.php` plus `routes/tenant_vcal_api.php`. **[x]**  
4. Minimum UI: host booking settings (`/vical`), public book page (`/book/{slug}`), confirmation (`/book/{slug}/thanks/{token}`). **[x]**  
5. Comms Hub token resolution for `{{workspace.booking_link}}` and related placeholders. **[ ]** (Module 4)  
6. Pest feature test `tests/Feature/Vcal/VcalModuleTest.php`. **[x]**  
7. Carina system context for `vcal_booking` and route `tenant.carina.fromVcalBooking`. **[x]**

---

## Hub and API CRUD (implemented)

**Tenant hub (`/vical`, Blade):** list, edit (GET `…/edit`), update (PUT), delete for event types; **new event types** are created on a dedicated page GET `tenant.vical.event-types.create` (`/vical/event-types/create`) posting to `tenant.vical.event-types.store`. Weekly availability is shown as a **Mon-Sun grid** with per-day time windows; an Alpine disclosure posts new windows to `tenant.vical.availability-rules.store`. **Pending approvals** for the signed-in host (and team queue for tenant admins) render as an **amber banner** at the top when non-empty. **Upcoming sessions** list each row with a **status pill**, guest summary, **Manage** (`tenant.vical.bookings.show`), and **Carina** (`tenant.carina.fromVcalBooking`) so hosts can jump straight into AI context for that booking. **Developer and embed** (public API base URLs, embed helper link, API secret regenerate, HMAC webhook note) lives in a **collapsed-by-default** disclosure so day-to-day scheduling stays primary. Blackout dates use the same collapsible pattern. The hub Blade sets `@section('carina_help_label', 'viCal booking hub')` so in-app Carina help targets this surface.

**Public book page (`/book/{slug}`):** multi-step flow uses a **numbered stepper** (Session, Date and time, Details, Confirm), **card-style radio** pickers for event types (replacing a plain select), larger calendar cells with a **slot-count dot** when the day has availability, and styled time-slot pills. The layout keeps the existing `bookPage()` Alpine object unchanged. When the controller passes Carina assist copy, guests are told they can open **Carina** from the workspace sidebar after sign-in for pre-booking questions.

**Calendar view (`tenant.vical.calendar`):** bookings are **grouped by local date** with a date header per group; each row shows a **status badge** plus Manage. Day, week, and month views use a **pill switcher**; navigation uses bordered ghost buttons with a primary **Today** action.

**Tenant sidebar:** Under **Modules**, viCal is a **collapsible group** in `resources/views/layouts/app.blade.php` with links to **Hub** (`tenant.vical.index` plus bookings, availability, blackouts), **Calendar**, **Analytics**, **Group events**, and **New event type** (`tenant.vical.event-types.create`, also highlights on event-type edit).

**Tenant JSON API (`/api/vcal/…`, same subdomain, `auth`):**

| Resource | List | Create | Update | Delete |
|----------|------|--------|--------|--------|
| Event types | GET `vcal/event-types` | POST | PATCH `vcal/event-types/{id}` | DELETE |
| Availability rules | GET `vcal/availability-rules` | POST | PATCH `vcal/availability-rules/{id}` | DELETE |
| Blackouts | GET `vcal/blackouts` | POST | PATCH `vcal/blackouts/{id}` | DELETE |
| Bookings | GET/POST `vcal/bookings` | POST | (lifecycle via approve/reject/cancel) | cancel PATCH |

**Routing note:** Tenant routes live on `{tenant_subdomain}.{base_domain}`. Controllers that need route IDs must read them with `$request->route('segment_name')`, not as a second method parameter after `Request`, because `tenant_subdomain` is also a bound route parameter and Laravel passes action arguments positionally from `array_values($route->parameters())`.

---

## Mentorship and learning path anchors (foundation)

**Tables:** `vcal_bookings.mentorship_relationship_id` (nullable FK to `mentorship_relationships`), `vcal_bookings.learning_path_assignment_id` (nullable FK to `learning_path_assignments`). `vcal_event_types.allowed_booking_contexts` JSONB: subset of `mentorship` and `learning_path`. `null` on the event type means both keys are allowed when IDs pass validation; `[]` forbids both optional anchors on new bookings.

**Validation (`App\Services\Vcal\VcalBookingAnchorValidator`):** the calendar host must be the mentor or mentee of any linked mentorship row (and `tenant_id` must match the current workspace when tenancy is initialized). A linked learning path assignment must belong to the host or to the tenant user whose email matches the booking guest email. If both FKs are set, the assignment `user_id` must be the mentor or mentee of that same relationship (cross-pair mismatches are rejected).

**Surfaces:** optional fields on `POST /book/{slug}` and `POST /api/vcal/bookings`. Hub event type create/edit includes checkboxes to allow or deny these anchors per session type. API event type create accepts `allowed_booking_contexts`; PATCH may update it.

**Carina:** `vcal_booking` system context loads `mentorshipRelationship` and `learningPathAssignment.learningPath` and summarises them in the booking block.

**Comms Hub tokens:** `{{booking.mentorship_relationship_id}}`, `{{booking.learning_path_name}}` (resolved in `CommunicationTemplateTokenService::contextFromVcalBooking`).

**Integrations:** `vical.booking.needs_review` and `vical.booking.confirmed` webhook payloads include `mentorship_relationship_id` and `learning_path_assignment_id` when set.

**Mentorship module:** `MentorshipRelationship::vcalBookings()` and `LearningPathAssignment::vcalBookings()` inverse relations are available for future UI (session list, mentor dashboard).

---

## Related knowledge

- `31-comms-and-engagement-engine.md` - sequences, tokens, booking link injection.  
- `22-tenant-route-map.md` - live tenant route layout as modules land.  
- `08-carina.md` - how Carina consumes structured workspace context.
