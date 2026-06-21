# Carina Ops Sprint 5.4: Usage limits and warnings

## Goal

Enforce monthly token limits and surface warnings in API and UI when approaching caps.

## Context

- Plan limits in `plan-features.ts` and `billing-plans.ts` `tokenLimit`
- `checkHostedQuota` in hosted chat; extend pattern for ops workbench
- Warning at 80%; hard block at 100% for workbench (chat may keep separate rules)

## Dependencies

- `24-billing-plan-ids.md`
- `21-ops-usage-credits-api.md`
- `26-stripe-webhook-plan-sync.md`

## Files to modify

- `core.carinaai.uk/src/api/hosted-billing.ts`
- `core.carinaai.uk/src/hosted/workbench-service.ts`
- `core.carinaai.uk/src/hosted/usage-service.ts`
- `core.carinaai.uk/src/gateway/web/ops/usage.html`
- `core.carinaai.uk/src/gateway/web/ops/index.html`

## Step-by-step

1. Add `checkOrgUsageQuota(orgId, plan): Promise<{ allowed: boolean; warning: boolean; used: number; limit: number }>`.

2. Call before workbench run; return 429:

```json
{ "error": "quota_exceeded", "used": 500000, "limit": 500000 }
```

3. `GET /api/carina-ops/credits` includes `warning: true` at 80%.

4. UI: yellow banner on overview and usage pages when warning.

5. Ops back office manual override: `daily_message_limit` / custom token limit on tenant detail (existing fields).

6. Audit `usage.quota_warning` once per day per org (avoid spam).

## Expected behavior

- Org at 100% cannot run workbench
- Org at 85% sees warning banner
- Upgrading plan raises limit immediately after webhook

## Test

Unit test quota math; integration test workbench returns 429 when over limit.

```bash
cd core.carinaai.uk && pnpm test src/hosted/usage-service.test.ts
```
