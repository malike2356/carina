# 14: Companies House lead source (wire-in)

**Status:** PENDING
**Priority:** P0 for UK limited-company lead quality
**Depends on:** 02 (sheet ingest); standalone `aiva-companies-house-api/` prompts 01-04
**Unlocks:** richer Monday scrape for Jakstar / UK outreach

## Goal

Outreach lead ingest can pull UK companies (and related officers) from the official Companies House API instead of fragile HTML scrape, then append normalised rows to the master sheet with `source=companies_house`.

## Upstream programme

Implement the full client + Aiva tools first:

`carina/01-devends/prompts-library/01-pending_prompts/aiva-companies-house-api/`

Official docs: https://developer.company-information.service.gov.uk/

## Wire-in requirements

1. Extend prompt 02 sheet schema with optional columns:
   - `company_number`, `company_status`, `sic_codes`, `registered_office`, `officer_names`
2. Add `source` value `companies_house` (keep scrape/manual/youtube_comment/import).
3. Owner utterance examples:
   - "Find 30 active companies on Companies House matching [name/SIC intent], add directors as contact names, queue them for outreach"
   - "Enrich my sheet rows that have company_number via Companies House"
4. Flow:
   - Search / advanced search → optional profile+officers enrich (rate-budgeted) → sheet append with dedupe on `company_number` **and** email when email exists
5. Honest gap: if no email, still allow `status=new` research rows OR skip for cold-send queue until email filled (config flag `require_email_for_queue` default true for send cadence; research rows may stay `new`).
6. Persona (12): prefer Companies House tools for UK ltd/llp lookups before browser scrape.
7. Smoke: add one CH-sourced row on Jakstar sheet in E2E (13) once API key is live.

## Acceptance criteria

- [ ] Instruction to search Companies House and add to sheet creates rows with company_number and source=companies_house.
- [ ] Dedupe on company_number works.
- [ ] Cold send path still refuses rows without email when require_email_for_queue is true.
- [ ] Rate limit errors surface to owner ("slow down / try later") without silent partial success claims.

## Deploy

After `aiva-companies-house-api` Core deploy; outreach ingest helper may ship in the same Core release.
