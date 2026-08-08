# Aiva CRM leads + outreach workspace CRUD

**Status:** ARCHIVED 2026-08-08 (COMPLETED)
**Created:** 2026-08-08
**Product:** Hire Aiva (`admin.hireaiva.co.uk` / `app.carinaai.uk`)
**Runtime note:** Contabo chat primary is Keprix when Ops `global_engine=keprix`; Soft Wall stays product-owned.

## Goal

Owners must open one clear workspace page, see CRM/outreach leads in a table, and let Aiva fully manage outreach (CRUD) from the UI, from chat, and from Telegram or any linked channel. Spreadsheet/CSV lead files must be first-class. File upload must work, and uploaded files must exercise Keprix tools/packs where needed.

## Why this set exists

Prior programmes shipped outreach APIs and `/aiva/outreach/*` pages, but owners still lack a single obvious CRM leads surface, reliable file upload into Aiva chat/workers, full spreadsheet lead-file CRUD, and channel-prompt parity with the UI. This set closes that gap without rebuilding a second CRM.

## Build order

| # | Prompt | Priority | Depends |
|---|---|---|---|
| 00 | Overview and guardrails | P0 | none |
| 01 | CRM leads workspace page (visible table + nav) | P0 | 00 |
| 02 | Outreach module full CRUD (API + agent tools) | P0 | 00, 01 |
| 03 | Spreadsheet / CSV lead files (create, read, manage) | P0 | 01, 02 |
| 04 | Channel prompt control (Telegram and all linked channels) | P0 | 02, 03 |
| 05 | File upload fix + Keprix tools/packs for files | P0 | 03 |
| 06 | Contact leads on ask (outbound with Soft Wall) | P0 | 02, 04 |
| 07 | Tests, smoke, deploy, sign-off, archive | P0 | 01-06 |

## Progress (2026-08-08)

| # | Status |
|---|---|
| 01 | Shipped (CRM Leads table, nav, `/aiva/crm/leads` alias, CSV upload/export, delete) |
| 02 | Shipped (lead + campaign/sequence/enrollment/list tools; export API/tool; Soft Wall process-due kept). Campaign/sequence hard-delete still pause-only (same as UI). |
| 03 | Shipped (workspace CSV lead sheets create/list/read/sync/push; Google create+link; CRM page linked files). XLSX still CSV-first. |
| 04 | Shipped via shared worker tool registration + channel system prompt (Telegram and other channels use same outreach tools). Live Telegram smoke still optional in 07. |
| 05 | Shipped (100MB decoded attachments, Express/Next 150mb body, wider MIME, CRM import guidance) |
| 06 | Shipped (`outreach-contact-leads` Soft Wall Approvals queue; pause respected) |
| 07 | Completed (tests + Contabo cloud deploy + web hot-patch; marketing 200) |

Start at `00`, then implement `01` first so the visual page exists before tool/channel work.

## Already shipped (reuse; do not rebuild)

- Routes: `/aiva/outreach`, `/aiva/outreach/leads`, `/aiva/outreach/pipeline`, campaigns, sequences, replies, bookings, Companies House
- Schema: `outreach_campaigns`, `outreach_leads`, timeline, messages (cloud `schema.ts`)
- APIs under `/api/aiva/outreach/*`
- Nav: Outreach primary item → `/aiva/outreach` (`aiva-nav.ts`)
- Contacts dossier: `/contacts`
- Keprix product sidecar: `crm.*`, `outreach.*`, Soft Wall, `agent.run`
- Chat primary cutover: Ops engine → Keprix invoke (CAS chat-engine)

## Gaps this set must close

1. CRM leads not obvious as a first-class workspace destination (owners cannot "go see the leads" after outreach).
2. Agent tools incomplete or not granted for full outreach CRUD from any channel.
3. Spreadsheet/CSV lead files not a durable, Aiva-managed artifact with full CRUD.
4. Aiva chat/worker file upload unreliable or rejected.
5. Uploaded files do not consistently invoke Keprix capabilities (parse, enrich, enroll, Soft Wall).
6. "Message these leads" from Telegram/web does not reliably enroll/contact with Soft Wall.

## Archive rule

When each prompt is fully Done When + validated, mark `**Status: COMPLETED YYYY-MM-DD**`, move to
`../02-archived_prompts/archives_from_pending_prompts/aiva-crm-outreach-workspace-crud/`,
update this README and `../README.md`, delete empty pending folders.

## Soft separation

Carina = runtime/tools/policy. Aiva = branding, nav, workspace pages, worker UX.
Reference: `shared/workspace-governance/CARINA-AIVA-SOFT-SEPARATION.md`.
Never nest `carina/verlox/`.
