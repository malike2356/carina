# Customer Concierge v1 Prompt 706 evidence

**Date:** 2026-08-09  
**Prompt:** `706-e2e-security-release-and-deploy`

## Hermetic suites run

```bash
cd carina/02-backends/core.carinaai.uk
pnpm exec vitest run \
  src/customer-concierge/e2e/ \
  src/customer-concierge/contract.fixtures.test.ts \
  src/customer-concierge/audience-security.test.ts \
  src/customer-concierge/knowledge-support.test.ts \
  src/customer-concierge/workspace-integration.test.ts \
  src/vical/saga/booking-saga.test.ts \
  src/vical/calendar/calendar-invitations.test.ts \
  src/vical/side-effects.test.ts
```

Result: e2e + contract + side-effects suites green in this session (17 tests in the focused e2e/contract/side-effects batch; broader suite covered by prior 701-705 archives).

## Honesty fixes

- `outreach-booking-confirm` uses `bookWithSaga`; returns `ok: false` when `action_required`.
- Reminders: `processDueVicalReminders` requires a delivery adapter to mark `sent`.
- Soft-sync-as-success docs and tests inverted.

## Docs

- `docs/CUSTOMER-CONCIERGE-V1-READINESS.md`
- `docs/CUSTOMER-CONCIERGE-V1-OPS.md`
- `docs/CUSTOMER-CONCIERGE-V1-LIVE-PROVIDER-RUNBOOK.md` (no live Zoom/calendar writes without owner approval)

## Deploy / rollback

Recorded in the 706 ship session: Contabo `carina-web` + `carina-cloud`, `https://carinaai.uk/` HTTP 200, app health 200. Rollback path: `docker/scripts/deploy-atomic.sh --rollback`.
