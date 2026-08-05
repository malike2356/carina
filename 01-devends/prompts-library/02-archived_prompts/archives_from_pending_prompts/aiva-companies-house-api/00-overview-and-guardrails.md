# 00: Overview and guardrails (Companies House)

**Status: COMPLETED 2026-08-04**
**What was built:**
- Reference guardrails applied for CH Public Data API (Basic auth, rate limits, no shell-exec).
**Depends on:** none
**Unlocks:** 01-05

## Context

Companies House Public Data API (live register):

- Hub: https://developer.company-information.service.gov.uk/
- Base URL: `https://api.company-information.service.gov.uk`
- Spec: https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/reference

Canonical Carina only under `02-backends/`, `03-frontends/`, `scripts/`. Aiva is a product surface on Carina; ship tools in Core and expose via worker tool grants.

## What this integration is for

| User ask | Primary endpoints |
|---|---|
| Find companies by name | `GET /search/companies` |
| Advanced filters | `GET /advanced-search/companies` |
| Find people (officers) by name | `GET /search/officers` |
| Company snapshot | `GET /company/{company_number}` |
| Officers of a company | `GET /company/{company_number}/officers` |
| PSC list | `GET /company/{company_number}/persons-with-significant-control` |
| Officer appointment history | `GET /officers/{officer_id}/appointments` |

## What this is not

- Not a cold-email source by itself: Companies House does **not** reliably provide prospect emails. Enrich company/officer identity; obtain emails via allowed outreach paths (sheet, web policy, owner paste).
- Not Document Filing / OAuth filing flows. P0 is **API key read-only** public data.
- Not streaming API.
- Not permission to scrape residential addresses beyond what the API returns as public (many are protected/partial).

## Auth model (P0)

HTTP Basic Auth: API key as username, empty password.  
Register an application on the Developer Hub → API Key application.  
Store key in `/opt/lampp/htdocs/verlox/.access/` pointer + VPS env (e.g. `COMPANIES_HOUSE_API_KEY`). Never commit keys. Never paste keys into chat/prompts.

Optional later: per-workspace key via `configure` / Tools, if product wants customer BYOK.

## Rate limits

600 requests per rolling 5 minutes per application. On `429`, honour `Retry-After`. Back off; do not tight-loop enrich jobs.

## Technical guardrails

1. No `carina/verlox/` nests.
2. Writing style: no em dashes, no en dashes, no emojis in first-party copy.
3. No `shell-exec` for Aiva to curl CH.
4. Prefer typed client module + session tools registered like Gmail/Sheets adapters.
5. Stripe: irrelevant unless billing gates the tool later; do not invent prices.
6. Compliance: public register use must match Companies House developer guidelines and Hire Aiva outreach policy (no harassment, respect suppressions).

## Architecture target

```
Env / workspace secret: COMPANIES_HOUSE_API_KEY
  -> companiesHouseClient (Basic auth, retry 429, pagination start_index)
  -> Aiva tools:
       companies-house-search-companies
       companies-house-search-officers
       companies-house-get-company
       companies-house-list-officers
       companies-house-list-psc
  -> optional: outreach ingest adapter (sheet rows source=companies_house)
  -> Tools UI grant + honest connect/configure CTA
```

## Out of scope for this programme

- Full accounts PDF/iXBRL parsing.
- Disqualified-officer deep investigation product.
- Replacing web-search for non-UK entities.
