# 02: Outreach module full CRUD (API + agent tools)

**Status: COMPLETED 2026-08-08**
**Priority:** P0
**Depends on:** 00, 01
**Unlocks:** 04, 06, 07
**Writing style:** plain ASCII only.

## What was built
- Lead CRUD tools + DELETE API (prior)
- Campaign/sequence/enrollment/list agent tools
- Lead export API/tool
- Soft Wall process-due kept; gmail-send discouraged for cold outreach in prompts
- Campaign/sequence hard-delete intentionally pause-only (matches UI)

## Goal

Aiva (worker + Ask Carina/help paths where appropriate) has **full read and write** over the outreach module: leads, campaigns, sequences, enrollments, lists, pipeline stage, replies review, bookings hooks. Same capabilities as the UI, exposed as tools the agent can call from any session.

## Why

UI alone is not enough. Owners ask Aiva in chat to "add these leads", "pause outreach", "move Ada to booked". Tools must be complete, granted to Aiva workers, and Soft Wall gated for outbound.

## Reuse first

- Core `src/outreach/*` (leads, campaigns, sequences, control, process-due)
- Cloud `/api/aiva/outreach/[...path]`
- Existing tools mentioned in help: `outreach-*`, `vical-*`
- Keprix nodes: `crm.*`, outreach/discovery where catalogued
- Soft Wall + Approvals

## Requirements

1. **Inventory and close gaps**
   Produce a matrix (in prompt notes or short doc under `docs/` only if needed; prefer code comments + tests) of UI actions vs tools vs API:
   - leads: list, get, create, update, delete, import, export
   - campaigns: list, create, update, pause/resume, delete
   - sequences: list, create, update steps, delete
   - enrollments: enroll, unenroll, list by lead/campaign
   - pipeline: set stage
   - control: pause/resume outreach, process-due
   - replies: list open, resolve
   - bookings: list/link via viCal tools (do not reimplement booking engine)
   Implement any missing API or tool; do not leave UI-only mutations.

2. **Agent tools**
   - Register/grant tools on Aiva worker sessions (product tool adapters / depth catalog).
   - Naming: consistent `outreach-*` prefix.
   - Each mutate tool returns structured JSON `{ ok, id?, error? }` and writes audit/timeline.
   - Outbound contact/send tools must create Soft Wall drafts (never silent send).

3. **Permissions**
   - Workspace-scoped only (`workspaceId` from worker/session context).
   - Read tools available when `outreach` feature on; write tools same.
   - No cross-tenant ids accepted from model (ignore foreign workspace ids).

4. **Keprix parity**
   - Where chat runs on Keprix primary, ensure capability grants include needed `crm.*` / outreach nodes OR Core HTTP tools remain callable via bridge.
   - Do not invent a parallel lead store inside Keprix.

5. **Tests**
   - Unit tests for create/update/delete/import helpers.
   - Tool registration test: Aiva worker session includes outreach CRUD tools.
   - Soft Wall path test for contact/send.

## Acceptance

- [ ] Every UI CRUD action has an API + agent tool (or documented alias).
- [ ] Aiva worker can list/create/update/delete a lead via tools in a Vitest or scripted turn.
- [ ] Delete and stage change appear in timeline/audit.
- [ ] Outbound contact cannot bypass Soft Wall.

## Done When

Aiva has full outreach module CRUD from tools, matching the workspace UI.
