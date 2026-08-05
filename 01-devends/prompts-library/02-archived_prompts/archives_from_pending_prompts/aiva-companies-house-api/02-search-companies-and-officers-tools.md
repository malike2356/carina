# 02: Search companies and officers (Aiva tools)

**Status: COMPLETED 2026-08-04**
**What was built:**
- Tools `companies-house-search-companies` / `companies-house-search-officers` via product adapters.
**Priority:** P0
**Depends on:** 01
**Unlocks:** 04, wire-in outreach 14

## Goal

Expose Companies House search so Aiva users can find UK companies and people (officers) by query from chat / Telegram.

## Endpoints

- `GET /search/companies?q=...`
- `GET /search/officers?q=...`
- Optional stretch: `GET /advanced-search/companies` for status/SIC filters when query needs it

## Requirements

1. Register tools (names suggested):
   - `companies-house-search-companies`
   - `companies-house-search-officers`
2. Wire via product tool adapters / toolset registration consistent with Gmail/Sheets patterns under `src/tools/`.
3. Parameters (companies):
   - `q` (required)
   - `itemsPerPage` (default 20, max 100)
   - `startIndex` (default 0)
4. Parameters (officers): same paging shape.
5. Return compact structured items to the model:
   - Companies: `company_number`, `title`, `company_status`, `company_type`, `date_of_creation`, `address_snippet`, public CH URI if present
   - Officers: `title`/`name`, `officer_role` if present, appointment snippet, links needed for follow-up get
6. Cap tool output size so context is not truncated (metadata-first; no dumping huge JSON).
7. Description text must tell the model: CH search does not return marketing emails; for outreach, next step is enrich + other email discovery paths.
8. Conversational intent (optional here or 04): phrases like "companies house", "find UK company", "search officers" → if key missing, CTA; else call tools.
9. Vitest: tool execute maps params to client and formats results.

## Acceptance criteria

- [ ] Aiva with grant can answer "search companies house for Acme Ltd" with numbered company results including company numbers.
- [ ] Officer search returns people matches without inventing data.
- [ ] Missing key → honest error / configure CTA, not blank reply.

## Example owner utterances

- "Find Companies House listings for dental practices named Smile in Manchester" (name search; refine with advanced search if needed)
- "Search officers named Jak Miah"
- "Is there a company called Sales Grid AI on Companies House?"
