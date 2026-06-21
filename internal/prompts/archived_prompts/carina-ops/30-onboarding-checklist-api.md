# Carina Ops Sprint 6.1: Onboarding checklist API

## Goal

Track self-serve onboarding progress so the UI can guide new customers to first value.

## Context

- Steps from implementation plan Sprint 6
- Data derived from existing tables; no separate onboarding state machine required in v1

## Dependencies

- `19-ops-vault-api.md`
- `20-ops-workbench-api.md`
- `22-ops-audit-log-api.md`

## Files to create

- `core.carinaai.uk/src/hosted/onboarding-service.ts`
- `core.carinaai.uk/src/hosted/onboarding-service.test.ts`

## Files to modify

- `core.carinaai.uk/src/api/carina-ops-routes.ts`

## Step-by-step

1. `GET /api/carina-ops/onboarding` returns:

```json
{
  "steps": [
    { "id": "register", "label": "Create account", "done": true },
    { "id": "org", "label": "Organization ready", "done": true },
    { "id": "billing", "label": "Start trial or subscribe", "done": false },
    { "id": "byok", "label": "Connect provider key", "done": false },
    { "id": "workbench", "label": "Run first prompt", "done": false },
    { "id": "usage", "label": "Review usage", "done": false },
    { "id": "invite", "label": "Invite teammate", "done": false }
  ],
  "completedCount": 2,
  "totalCount": 7,
  "percentComplete": 28
}
```

2. Derive `done` flags:

- `billing`: plan not free OR trial active
- `byok`: count vault entries > 0
- `workbench`: count workbench runs > 0
- `usage`: user visited usage (store `onboarding_flags` JSON on org OR infer from audit `usage.viewed`)
- `invite`: count memberships > 1 OR pending invites

3. Optional `POST /api/carina-ops/onboarding/dismiss` to hide wizard for org.

## Expected behavior

- Fresh org shows 2/7 complete after register
- After BYOK + workbench, percent jumps appropriately

## Test

```bash
cd core.carinaai.uk && pnpm test src/hosted/onboarding-service.test.ts
```
