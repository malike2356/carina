# Carina Ops Sprint 5.1: Billing plan IDs in core and ops

## Goal

Align billing plan catalog across core and ops with Carina Ops Starter and Team plans.

## Context

- Ops catalog: `ops.carinaai.uk/lib/billing-plans.ts`
- Core billing: `src/api/hosted-billing.ts`, `src/billing/subscription-manager.ts`
- Scout plans must remain separate

## Dependencies

- `00-lock-spec-and-boundaries.md`
- `13-plan-gates-module.md`

## Files to modify

- `ops.carinaai.uk/lib/billing-plans.ts`
- `ops.carinaai.uk/lib/billing-plans.test.ts`
- `core.carinaai.uk/src/api/hosted-billing.ts`
- `core.carinaai.uk/src/billing/subscription-manager.ts`
- `core.carinaai.uk/src/hosted/plan-features.ts`

## Step-by-step

1. Ensure both packages export identical plan IDs:

- `carina_ops_starter` (£49)
- `carina_ops_team` (£99)

2. Add `normalizePlanId()` handling in core billing matching ops.

3. Update `subscriptions.plan` CHECK in migrations (if not done in prompt 01).

4. Map legacy `tier` field on `hosted_users` (`free`/`pro`) to org plan without breaking chat quota.

5. `ASSIGNABLE_PLANS` in ops includes new IDs for manual override UI.

6. Update tests in both packages for new plan IDs.

## Expected behavior

- `getPlan('carina_ops_starter')` returns £49 and feature list
- Scout plans unchanged
- Unknown plan ID throws or normalizes to free

## Test

```bash
cd ops.carinaai.uk && pnpm test lib/billing-plans.test.ts
cd core.carinaai.uk && pnpm test src/api/__tests__/hosted-billing.test.ts
```
