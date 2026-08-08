# Aiva CRM leads + outreach workspace CRUD

**Status:** OPEN (implementation prompts)
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
| 01 | In progress / largely shipped this session (CRM table, nav, alias, CSV upload/export, delete) |
| 02 | Partial (lead CRUD tools + DELETE API; campaigns/sequences tool gaps remain) |
| 03 | Partial (CSV file upload/export on CRM page; Google Sheet create still open) |
| 04 | Pending (tools registered for channel sessions via existing adapter path; intent smoke still open) |
| 05 | Partial (100MB limit, wider MIME, Express/Next body 150mb, attachment prompt for CRM import) |
| 06 | Pending |
| 07 | Pending |

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
