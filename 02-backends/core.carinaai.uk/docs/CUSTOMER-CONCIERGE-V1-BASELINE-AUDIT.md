# Customer Concierge v1 baseline audit (Prompt 700)

**Date:** 2026-08-09  
**Scope:** `carina/02-backends/core.carinaai.uk/`  
**Architecture:** `shared/workspace-governance/AIVA-KEPRIX-CUSTOMER-CONCIERGE-BOOKING.md`  
**Contract package:** `contracts/customer-concierge-v1/`

This table names exact modules to extend. Do not build parallel booking or CRM stores.

## Soft-fail calendar sync (known gap)

| Path | Note |
| --- | --- |
| `src/vical/calendar-sync.ts` | On create failure sets `calendarSyncStatus: 'failed'` and warns that booking stays confirmed |
| `src/tools/outreach-booking-tools.ts` | Creates booking first; calendar sync is soft-fail |
| `docs/VICAL-OPS.md` | Documents soft-sync behavior |

Architecture forbids leaving a meeting fully confirmed without a usable invitation projection. Prompt 703/704 must replace soft-fail with saga + `action_required`.

## Evidence table

### 1. Public widget / sessions

| Status | Path | Note |
| --- | --- | --- |
| REUSABLE | `src/widget/widget-router.ts` | Session create/resume, SSE chat, publish gate |
| REUSABLE | `widget/src/*` | Embed client |
| INCOMPLETE | `src/widget/widget-router.ts` | CORS `*`; origin allowlist on profile not enforced; no Channel Shield |
| MISSING | Audience session principal (Prompt 701) | |

### 2. Worker message loop / persona

| Status | Path | Note |
| --- | --- | --- |
| REUSABLE | `src/workers/aiva-process-message.ts` | Stream loop, knowledge inject, concierge overlay |
| REUSABLE | `src/workers/workspace-message-handler.ts` | Inbound/outbound (re-exported as aiva-message-handler) |
| REUSABLE | `src/workers/persona-builder.ts` | Identity override |
| INCOMPLETE | Knowledge filter | `knowledgeSourceIds` stored but runtime injects all enabled KB entries |
| MISSING | Deny-by-default external tool policy (Prompt 701) | |

### 3. Channel identities / contacts

| Status | Path | Note |
| --- | --- | --- |
| REUSABLE | `src/memory/aiva/contact-identity.ts` | Channel identity links |
| REUSABLE | `src/contacts/*`, `src/tools/contacts-tool.ts` | CRM contacts |
| MISSING | Contracted `audience_identity` / `audience_session` persistence | |

### 4. Channel Shield

| Status | Path | Note |
| --- | --- | --- |
| REUSABLE | `src/channel-shield/*` | Pipeline, quarantine, web adapter |
| INCOMPLETE | Widget path | Shield intercept is in `src/channels/message-router.ts`, not widget-router |

### 5. Knowledge

| Status | Path | Note |
| --- | --- | --- |
| REUSABLE | `src/workers/knowledge-base.ts` | Worker KB CRUD + persona append |
| INCOMPLETE | Published-only retrieval | No filter by concierge `knowledgeSourceIds`; no dedicated RAG slice |

### 6. Outreach / lead funnel

| Status | Path | Note |
| --- | --- | --- |
| REUSABLE | `src/outreach/*`, `src/api/aiva-outreach-api.ts` | Leads, cadence, bookings bridge |
| REUSABLE | `docs/AIVA-LEAD-FUNNEL-CAPABILITY-MATRIX.json` | Capability matrix |
| INCOMPLETE | Soft-fail calendar confirm | Dual stores (outreach + viCal) with cutover helpers |

### 7. viCal bookings / slots / holds

| Status | Path | Note |
| --- | --- | --- |
| REUSABLE | `src/vical/{bookings,slots,locks,types,ics,reminders,side-effects}.ts` | Full module |
| REUSABLE | `src/api/aiva-vical-api.ts`, `src/tools/vical-booking-tools.ts` | API + tools |
| INCOMPLETE | `src/vical/store.ts` | File-backed store; not workspace Postgres |
| MISSING | Provider-neutral booking saga (Prompt 703) | |

### 8. Google Calendar

| Status | Path | Note |
| --- | --- | --- |
| REUSABLE | `src/workers/product-tools/google-driver.ts` | list/create/update/delete |
| REUSABLE | Google OAuth product-tool flow | Used by concierge setup |
| INCOMPLETE | Soft-fail sync | See soft-fail section |

### 9. Microsoft Calendar

| Status | Path | Note |
| --- | --- | --- |
| REUSABLE | Concierge type + readiness placeholders | `calendarProvider: microsoft` |
| INCOMPLETE | `outlook-calendar` catalog `coming_soon` | Email Outlook OAuth is not calendar write |
| MISSING | Microsoft Graph calendar driver | |

### 10. Zoom / conferencing

| Status | Path | Note |
| --- | --- | --- |
| REUSABLE | `src/workers/product-tools/zoom-oauth.ts` | Connection only (Prompt 698) |
| INCOMPLETE | Booking uses `zoomRoomUrl` | Location/join link only |
| MISSING | Zoom meeting create/reconcile + webhooks (Prompt 703/704) | |

### 11. Reminders

| Status | Path | Note |
| --- | --- | --- |
| REUSABLE | `src/vical/reminders.ts` | Schedule on confirm |
| INCOMPLETE | `processDueVicalReminders` | Marks sent; no proof-of-delivery channel |

### 12. Booking webhooks

| Status | Path | Note |
| --- | --- | --- |
| REUSABLE | `src/webhooks/*`, `src/vical/side-effects.ts` | Outbound `vical.booking.*` dispatch |
| MISSING | Inbound Zoom/Google/Microsoft reconcile + v1 event envelope fields | |

### 13. ICS

| Status | Path | Note |
| --- | --- | --- |
| REUSABLE | `src/vical/ics.ts` | Minimal VEVENT |
| INCOMPLETE | No METHOD:REQUEST / cancel ICS round-trip | Prompt 704 |

### 14. Concierge profiles (Prompt 698)

| Status | Path | Note |
| --- | --- | --- |
| REUSABLE | `src/workers/concierge-profile.ts`, `src/api/concierge-setup.ts` | Setup wizard + publish |
| REUSABLE | `src/infrastructure/migrations/040-concierge-profiles.sql` | |
| EXTENDED (700) | `src/customer-concierge/readiness.ts` | Provider readiness with `not_configured` |

### 15. Feature flags

| Status | Path | Note |
| --- | --- | --- |
| REUSABLE | `src/workers/aiva-feature-flags.ts` | Pattern for env/pilot flags |
| ADDED (700) | `AIVA_CONCIERGE_*_ENABLED` via `src/customer-concierge/readiness.ts` | |

### 16. Contracts

| Status | Path | Note |
| --- | --- | --- |
| REUSABLE pattern | `contracts/propreneur-aiva-tools.v1.json` | Versioned JSON contract style |
| ADDED (700) | `contracts/customer-concierge-v1/` | Schemas, fixtures, compatibility README |
| ADDED (700) | `src/customer-concierge/*` | Types, zod validators, readiness |

## Keprix parallel (compat only; no import)

| Area | Path |
| --- | --- |
| viCal | `keprix/src/keprix/vical/` |
| Conferencing | `keprix/src/keprix/vical/conferencing.py` (URL/template only) |
| Vault | `keprix/src/keprix/vault/` |
| CRM handoff | `keprix/src/keprix/crm/booking.py`, `outreach/vical_handoff.py` |

Keprix vendors `shared/contracts/customer-concierge-v1/` (or an identical copy). No Carina runtime dependency.

## Prompt mapping

| Prompt | Extends |
| --- | --- |
| 701 | Widget + message loop + Channel Shield + audience principal |
| 702 | Knowledge filter + support cases + handoff |
| 703 | viCal saga + Zoom create + hard invitation rules |
| 704 | Calendar webhooks + ICS + reconciliation |
| 705 | Outreach stop/cadence + operator inbox analytics |
| 706 | E2E security + release |
