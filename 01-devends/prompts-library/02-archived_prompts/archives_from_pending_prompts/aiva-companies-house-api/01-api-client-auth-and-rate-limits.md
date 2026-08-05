# 01: API client, auth, and rate limits

**Status: COMPLETED 2026-08-04**
**What was built:**
- `src/integrations/companies-house/{client,types,errors}.ts` + `.env.example` + `.access` pointer.
**Priority:** P0
**Depends on:** 00
**Unlocks:** 02, 03, 05

## Goal

Ship a small, tested Companies House HTTP client in Core with Basic auth, pagination helpers, and 429 backoff.

## Docs

- Auth: https://developer.company-information.service.gov.uk/authentication
- Authorisation guide: https://developer-specs.company-information.service.gov.uk/guides/authorisation
- Rate limiting: https://developer-specs.company-information.service.gov.uk/guides/rateLimiting
- Guidelines: https://developer.company-information.service.gov.uk/developer-guidelines

## Requirements

1. New module path (suggested): `carina/02-backends/core.carinaai.uk/src/integrations/companies-house/`
   - `client.ts` (fetch wrapper)
   - `types.ts` (minimal response types)
   - `errors.ts` (`CompaniesHouseAuthError`, `CompaniesHouseRateLimitError`, `CompaniesHouseNotFoundError`)
2. Auth: `Authorization: Basic base64(apiKey + ':')` (empty password).
3. Base URL constant: `https://api.company-information.service.gov.uk` (overridable via env for mocks only).
4. Read API key from `process.env.COMPANIES_HOUSE_API_KEY` (and document in Core `.env.example`). Optional workspace override later (04).
5. Methods (thin):
   - `searchCompanies({ q, itemsPerPage, startIndex })`
   - `searchOfficers({ q, itemsPerPage, startIndex })`
   - `getCompany(companyNumber)`
   - `listOfficers(companyNumber, { itemsPerPage, startIndex })`
   - `listPsc(companyNumber, { itemsPerPage, startIndex })`
6. Pagination: honour `start_index` / `items_per_page` / `total_results`; never assume a single page for officers/PSC.
7. On HTTP 429: parse `Retry-After` (seconds); sleep once and retry up to N=2; then throw typed rate-limit error.
8. On 401/403: typed auth error with message suitable for Tools CTA (no key leak).
9. On 404: typed not-found.
10. TLS only; no http:// fallback.
11. Log request path + status server-side; never log the API key.
12. Operator setup note in `.access/README.md` pointer style: register app at Developer Hub, store key under `.access/` (do not commit the key file contents into this prompt).

## Acceptance criteria

- [ ] Unit tests with mocked fetch cover auth header shape, 429 retry once, 404 mapping.
- [ ] `.env.example` documents `COMPANIES_HOUSE_API_KEY`.
- [ ] Client refuses to call when key missing (clear error).

## Deploy

Core only. Requires env set on Contabo before live smoke (05).
