# 01: CRM Leads workspace page (visible table + nav)

**Status: COMPLETED 2026-08-08**
**Priority:** P0
**Depends on:** 00
**Unlocks:** 02, 03, 07
**Writing style:** plain ASCII only.

## What was built
- CRM Leads table at `/aiva/outreach/leads` with search, filters, bulk stage, delete, CSV paste/upload/export
- Alias `/aiva/crm/leads`
- Nav Outreach primary → CRM leads; hub titled CRM + outreach

## Goal

Ship (or harden) a first-class **CRM Leads** page in the Aiva workspace so after any outreach run, the owner can open one URL and see leads in a table with full UI CRUD.

## Why

Owners currently struggle to "see the leads" as CRM inventory. `/aiva/outreach/leads` may exist but must become the obvious destination: clear nav label, table, filters, row actions, empty states, and deep links from Outreach hub.

## Reuse first

- `app/(workspace)/aiva/outreach/leads/page.tsx`
- `app/(workspace)/aiva/outreach/pipeline/page.tsx`
- `/api/aiva/outreach/leads` (+ import)
- `aiva-nav.ts` Outreach item; `workspace-features` key `outreach`
- Contacts page patterns for table density and dossiers

## Requirements

1. **Primary nav entry**
   - Label usable as CRM: either rename/clarify Outreach hub subtitle to "CRM + outreach", or add a primary/secondary item **Leads** → `/aiva/outreach/leads` (or `/aiva/crm/leads` that redirects to the same page).
   - Hub card "Leads" on `/aiva/outreach` must remain and link to the table page.
   - Feature flag: respect `outreach` workspace feature (already wired).

2. **Leads table (must be visible, not a card dump only)**
   Columns at minimum: name, email, company, stage/status, source, campaign, last touch, next follow-up, actions.
   - Search by name/email/company.
   - Filter by stage, source, campaign.
   - Sort by created / next follow-up / name.
   - Pagination or virtualised list for 500+ rows.
   - Empty state: "No leads yet" + Import CSV + Add lead + Ask Aiva CTA.

3. **UI CRUD**
   - Create lead (modal or inline form).
   - Edit lead (inline or detail drawer/page).
   - Delete lead (confirm; Soft Wall not required for delete of draft lead, audit log required).
   - Bulk select: delete, change stage, enroll in campaign/sequence.
   - Row click opens `/aiva/outreach/leads/[leadId]` with timeline + contact actions.

4. **After outreach**
   - When import or Companies House or scrape adds leads, toast + "View leads" link to this page.
   - Pipeline board and leads table stay in sync (same store).

5. **Aiva branding**
   - Page title e.g. "CRM Leads" with short subtitle: "Leads Aiva can contact for you."
   - No Carina-platform jargon in owner copy.

6. **Tests**
   - Component or route tests for table render + feature gate.
   - Update `aiva-nav.test.ts` / help knowledge if nav labels change.

## Files (expected)

- `app.carinaai.uk/src/app/(workspace)/aiva/outreach/leads/page.tsx` (harden)
- Optional alias route `aiva/crm/leads`
- `src/lib/aiva-nav.ts`, `OutreachTabNav.tsx`, help strings in `carina-help`
- API query params if filters need server support

## Acceptance

- [ ] Signed-in owner reaches CRM Leads from sidebar/hub without guessing.
- [ ] Table shows persisted leads after CSV import and manual create.
- [ ] Create / edit / delete / stage change work from the UI.
- [ ] Mobile viewport usable (table scrolls; actions not clipped).
- [ ] Writing-style scan clean on new copy.

## Done When

Owner can run outreach and immediately open a visual CRM leads table in the Aiva workspace with full UI CRUD.
