# Companies House integration

## Overview

Hire Aiva can search the official UK Companies House Public Data API for companies and officers, then enrich a company number with profile, officers, and persons with significant control (PSC).

Official docs:

- Developer Hub: https://developer.company-information.service.gov.uk/
- Public Data API reference: https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/reference
- Auth: HTTP Basic, API key as username, empty password
- Rate limit: 600 requests per rolling 5 minutes per application; honour `Retry-After` on HTTP 429

This integration is read-only. It does **not** provide reliable prospect emails. Use Companies House for identity/status, then other allowed outreach paths for email.

## Ops setup (platform key)

1. Sign in at https://developer.company-information.service.gov.uk/
2. Register an **API Key** application.
3. Optionally restrict the key by Contabo egress IP if stable.
4. Store the key under `/opt/lampp/htdocs/verlox/.access/` (see `.access/README.md` pointer `.companies-house-api-key.md`). Never commit the key.
5. Inject into Core runtime as `COMPANIES_HOUSE_API_KEY`. Optional: `COMPANIES_HOUSE_BASE_URL` (defaults to the live API; mocks only).
6. Redeploy / recreate `carina-web` so the env is visible.
7. On `/aiva/tools?tool=companies-house`, Create + probe (platform key is enough), then **Grant** the worker.
8. Workspace UI (Carina and Aiva share this surface): `/companies-house` for operator search + profile (Core routes under `/api/companies-house/*`).

Rotate keys on schedule; delete unused Developer Hub apps.

## Configure / BYOK

`configure integration:companies-house` can store a workspace key and run a smoke GET against company `00000006`. Vault BYOK uses Tools vault label `companies-house-api-key`.

## Aiva tools (granted worker)

| Tool | Purpose |
|---|---|
| `companies-house-search-companies` | Name / query search |
| `companies-house-search-officers` | Officer name search |
| `companies-house-get-company` | Profile by company number |
| `companies-house-list-officers` | Officers list (paginated, capped) |
| `companies-house-list-psc` | PSC list or clear none/protected message |

Batch enrich helper: `enrichCompanyFromNumber` / `enrichCompaniesBatch` in Core (`source=companies_house`). Default batch size 20 companies per owner instruction to stay under rate limits with headroom.

## Smoke checklist

1. Search companies `q=BBC`
2. Get company for one returned `company_number`
3. List officers for that number
4. From Hire Aiva chat with grant: "Search Companies House for [test name]"

Never paste API keys into chat, logs, or screenshots.
