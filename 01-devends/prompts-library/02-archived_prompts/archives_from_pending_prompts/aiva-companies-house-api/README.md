# Aiva Companies House API (find companies and people)

**Status: COMPLETED 2026-08-04**  
**Created:** 2026-08-04  
**Owner surface:** Hire Aiva / Carina (shared Core tools; Aiva worker grants)  
**Docs:** [Companies House Developer Hub](https://developer.company-information.service.gov.uk/) · [Public Data API reference](https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/reference)

**What was built:**
- Core HTTP client (`src/integrations/companies-house/`) with Basic auth, 429/`Retry-After`, typed errors, pagination, enrich helper (`source=companies_house`)
- Aiva tools: search companies/officers, get-company, list-officers, list-psc
- Product catalog slug `companies-house`, session adapters, risk registry, configure domain `integration:companies-house`
- Conversational setup + empty-reply CTAs; cloud Tools Guide Me; OPS Fleet page `/companies-house` (save/test/grant-all)
- Contabo: `COMPANIES_HOUSE_API_KEY` on `carina-web`; 10 active workers granted; live API smoke HTTP 200
- Prompt routing fix so Selorm/Telegram uses callable CH tools instead of website-only fallback

## Problem statement

UK outreach and research need official register data: search companies by name/SIC/location proxies, open company profiles, list officers and persons with significant control (PSC).

## Build order (archived P0)

| ID | Prompt | Result |
|---|---|---|
| 00 | Overview and guardrails | COMPLETED |
| 01 | API client, auth, rate limits, secrets | COMPLETED |
| 02 | Search companies and officers | COMPLETED |
| 03 | Company profile, officers list, PSC enrich | COMPLETED |
| 04 | Grants, Tools UI, configure path | COMPLETED |
| 05 | Tests, smoke, ops runbook | COMPLETED |

## Remaining open work (not in this archive)

Person-lookup auto-CH: still pending as `01-pending_prompts/aiva-companies-house-api/06-person-lookup-includes-companies-house.md` (owner chat smoke).

Outreach sheet ingest: `aiva-outreach-discovery-funnel/14-companies-house-lead-source.md`.

## Progress

- [x] 00 overview
- [x] 01 client + auth
- [x] 02 search tools
- [x] 03 profile / officers / PSC
- [x] 04 grants + UI
- [x] 05 tests + Contabo smoke / ops runbook
