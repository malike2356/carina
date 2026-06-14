# Carina Ops Sprint 3.1: Plan gates module

## Goal

Implement `requireOpsPlan` and feature limit checks for free, Starter, and Team tiers.

## Context

- Plan features defined in `src/hosted/plan-features.ts` (prompt 00)
- Org plan stored on `organizations.plan` synced from `subscriptions.plan`
- Gates apply to `/ops` UI and `/api/carina-ops/*` routes

## Dependencies

- `03-rbac-module.md`
- `08-org-context-helper.md`

## Files to create

- `core.carinaai.uk/src/hosted/plan-gates.ts`
- `core.carinaai.uk/src/hosted/plan-gates.test.ts`

## Step-by-step

1. Implement:

```typescript
export async function getOrgPlan(orgId: string): Promise<PlanTier>;
export function hasOpsConsole(plan: PlanTier): boolean;
export function checkFeature(plan: PlanTier, feature: keyof PlanFeatureLimits): boolean;
export function requireOpsPlan(minPlan: PlanTier): Middleware;
export function requireFeature(feature: keyof PlanFeatureLimits): Middleware;
```

2. Plan ordering: `free < carina_ops_starter < carina_ops_team`

3. `requireOpsPlan('carina_ops_starter')` returns 402 JSON:

```json
{ "error": "upgrade_required", "plan": "carina_ops_starter", "upgradeUrl": "/ops/billing" }
```

4. Free tier: chat allowed, ops console blocked.

5. Trial: if `subscriptions.trial_ends_at > now()`, treat as Team temporarily (wire fully in prompt 29).

## Expected behavior

- Free user hitting `/api/carina-ops/overview` gets 402 upgrade_required
- Starter user passes starter gates, blocked on deployments feature

## Test

```bash
cd core.carinaai.uk && pnpm test src/hosted/plan-gates.test.ts
```
