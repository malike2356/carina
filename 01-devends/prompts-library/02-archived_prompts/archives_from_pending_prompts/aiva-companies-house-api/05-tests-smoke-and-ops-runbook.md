# 05: Tests, smoke, and ops runbook

**Status: COMPLETED 2026-08-04**
**What was built:**
- Vitest mocks; Contabo live key + smoke; ops runbook `docs/integrations/companies-house.md`.
**Priority:** P0
**Depends on:** 01-04
**Unlocks:** programme archive

## Goal

Prove Companies House search and enrich in Vitest and on Contabo; leave operators a short runbook.

## Tests

1. Client unit tests: auth header, missing key, 429 once then success, 404.
2. Tool unit tests: search companies/officers formatting; get company; list officers pagination loop stops correctly.
3. No live network in CI unit tests (mock fetch).

## Contabo smoke (manual or scripted)

1. Set `COMPANIES_HOUSE_API_KEY` from Developer Hub app (store under `.access/`, inject to Core env; never commit).
2. Redeploy/recreate `carina-web` so env is visible.
3. From OPS or a test worker with grant:
   - Search companies `q=BBC`
   - Get company for one returned `company_number`
   - List officers for that number
4. From Hire Aiva chat (Jakstar or Selorm): "Search Companies House for [test name]" must return tools-backed answer.
5. Capture status codes and counts (no API key in logs/screenshots).

## Ops runbook (short markdown in Core docs or `.access/README` pointer)

1. Create account / sign in at https://developer.company-information.service.gov.uk/
2. Register application type API Key.
3. Restrict key by IP if Contabo egress IPs are stable.
4. Put key in `.access/` and Core runtime env as `COMPANIES_HOUSE_API_KEY`.
5. If banned/rate-limited: stop batch jobs; wait for window; contact CH only if sustained need for higher limit.
6. Rotate keys on schedule; delete unused apps.

## Acceptance criteria

- [ ] Vitest green for companies-house module + tools.
- [ ] Live smoke steps 3-4 pass.
- [ ] Runbook exists and points to official hub (no secrets inline).
- [ ] Parent README progress ticked; ready to archive when outreach wire-in also green.
