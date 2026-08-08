# 03: Spreadsheet and CSV lead files (create, read, manage)

**Status: COMPLETED 2026-08-08**
**Priority:** P0
**Depends on:** 01, 02
**Unlocks:** 04, 05, 07
**Writing style:** plain ASCII only.

## What was built
- Workspace CSV lead sheets create/list/read/sync/push + store handles
- Google Sheets create action + link tool
- CRM page Create leads sheet + linked files + canonical export columns
- `campaign_id` on discovery sheet schema

## Goal

Aiva can create, read, update, and manage **lead files** as spreadsheets (workspace CSV/XLSX and Google Sheets when connected), keep them synced with CRM leads, and expose that from UI and tools.

## Why

Owners think in sheets. Lead gen often starts as a file. Aiva must own the file lifecycle, not only paste-import.

## Reuse first

- `google-sheets-list` / append / write adapters in product tools
- `csv-parse` utility tool
- Documents / Files workspace surfaces
- Outreach import API (`leads/import`)
- Companies House import-lead path

## Requirements

1. **Canonical sheet schema** (align with prior funnel prompts)
   Columns minimum:
   `lead_id`, `business_name`, `contact_name`, `email`, `website`, `source`, `niche`, `location`, `status`, `last_touch_at`, `notes`, `campaign_id` (optional)
   Status values align with pipeline stages.

2. **Create**
   - Tool + UI: "Create leads spreadsheet" → workspace file (CSV or XLSX) and/or Google Sheet.
   - Persist spreadsheet id / file path on workspace outreach config.
   - Seed header row only.

3. **Read / manage**
   - List known lead files for workspace.
   - Read rows with pagination.
   - Append / update / soft-delete rows by `lead_id` or email.
   - Dedupe on email (case-insensitive).
   - Bidirectional sync helper: sheet → `outreach_leads` and optional push of stage changes back to sheet.

4. **UI**
   - On CRM Leads page: Import file (CSV/XLSX upload), Export CSV, "Open linked sheet" when Google id present.
   - Show linked file name and last sync time.

5. **Agent behaviour**
   - Prompts like "create a leads sheet for UK dentists" and "show me row 12" must work via tools.
   - Prefer workspace file if Google not connected; clear error if Google required and missing.

6. **Tests**
   - Schema validation + dedupe.
   - Import 10-row CSV → leads table count.
   - Sync does not duplicate emails.

## Acceptance

- [ ] Aiva can create a lead spreadsheet and store its handle.
- [ ] Aiva can read and update rows; CRM table reflects imports.
- [ ] Export from CRM Leads downloads CSV matching schema.
- [ ] Google Sheets path works when OAuth connected; otherwise workspace file path works.

## Done When

Lead spreadsheets are first-class CRUD artifacts for Aiva and the CRM Leads UI.
