# 03: Company profile, officers list, PSC enrich

**Status: COMPLETED 2026-08-04**
**What was built:**
- get-company, list-officers, list-psc + enrich helper for outreach.
**Priority:** P0
**Depends on:** 01, 02
**Unlocks:** 04, outreach wire-in enrichment

## Goal

Given a company number, Aiva can pull profile, officers, and persons with significant control for research / lead enrichment.

## Endpoints

- `GET /company/{company_number}`
- `GET /company/{company_number}/officers`
- `GET /company/{company_number}/persons-with-significant-control`
- Optional: `GET /officers/{officer_id}/appointments` when digging a person across companies

## Requirements

1. Tools (suggested):
   - `companies-house-get-company`
   - `companies-house-list-officers`
   - `companies-house-list-psc`
   - Optional P1: `companies-house-officer-appointments`
2. Profile fields to surface: company name, number, status, type, date of creation, SIC codes, registered office address (public), has been liquidated / accounts overdue flags if present.
3. Officers: paginate until configured max (e.g. 50) or total_results; include name, role, appointed_on, resigned_on, nationality (if public), country of residence (if public). Never invent missing fields.
4. PSC: list individuals/corporate entities with natures of control; handle empty / exempt / super-secure responses honestly.
5. Enrich helper (pure function) used by outreach:
   - Input: company number or search hit
   - Output: normalised enrich record for sheet columns (`company_number`, `company_status`, `sic`, `registered_office`, `officer_names`, `source=companies_house`)
6. Rate-budget: batch enrich must sleep/back off; document max companies per owner instruction (e.g. 20/run default) to stay under 600/5min with headroom.
7. Tests with fixture JSON from public API responses (use a well-known company number in fixtures, not live calls in unit tests).

## Acceptance criteria

- [ ] `get-company` for a known number returns status + registered office snippet.
- [ ] Officers list includes at least one current officer for that fixture.
- [ ] PSC tool returns list or a clear "none / protected / not available" message.
- [ ] Enrich helper is reusable from outreach ingest without scraping HTML.

## Privacy

Do not store or display more personal data than the API returns. Do not attempt to reverse residential address restrictions.
