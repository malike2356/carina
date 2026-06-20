# Carina Ops Sprint 0: Lock spec and boundaries

## Goal

Freeze product scope and billing plan IDs before any schema or customer UI work begins.

## Context

- Implementation plan: `instructions/strategy/CARINA_OPS_IMPLEMENTATION_PLAN.md`
- Customer product lives on `app.carinaai.uk` in `core.carinaai.uk/`, not `ops.carinaai.uk/`
- `ops.carinaai.uk/routes/ai-platform.ts` is an internal prototype; do not add customer features there
- Existing operator machine API: `core.carinaai.uk/src/api/ops-routes.ts` (CARINA_OPS_TOKEN); do not confuse with customer Carina Ops

## Dependencies

None. Run this first.

## Files to modify

- `ops.carinaai.uk/routes/ai-platform.ts`
- `ops.carinaai.uk/lib/billing-plans.ts`
- `core.carinaai.uk/src/api/hosted-migrations.ts` (plan CHECK constraint comment only if needed)
- `core.carinaai.uk/.env.example`
- `core.carinaai.uk/src/config/index.ts` (if new env vars need typing)

## Files to create

- `core.carinaai.uk/src/hosted/plan-features.ts` (feature flag map)

## Step-by-step

1. Add a file header comment to `ops.carinaai.uk/routes/ai-platform.ts`:

```typescript
// INTERNAL_PROTOTYPE: VERLOX back-office only. Customer Carina Ops UI belongs on app.carinaai.uk.
// Do not add customer-facing routes here. See instructions/action-prompts/carina-ops/.
```

2. Extend `BillingPlanId` in `ops.carinaai.uk/lib/billing-plans.ts`:

```typescript
export type BillingPlanId =
  | 'free'
  | 'carina_ops_starter'
  | 'carina_ops_team'
  | 'scout_monitor'
  | 'scout_pro'
  | 'scout_standard'
  | 'enterprise';
```

Add plan entries:

- `carina_ops_starter`: £49/mo, features: BYOK (3 providers), workbench, basic audit, ops console
- `carina_ops_team`: £99/mo, features: multi-user, deployments, environments, exports

Keep Scout plans unchanged. Add both new IDs to `ASSIGNABLE_PLANS`.

3. Create `core.carinaai.uk/src/hosted/plan-features.ts` exporting:

```typescript
export type PlanTier = 'free' | 'carina_ops_starter' | 'carina_ops_team';

export interface PlanFeatureLimits {
  opsConsole: boolean;
  maxMembers: number;
  maxByokProviders: number;
  auditRetentionDays: number;
  deployments: boolean;
  exports: boolean;
}

export const PLAN_FEATURES: Record<PlanTier, PlanFeatureLimits>;
export function normalizePlanId(raw: string): PlanTier;
```

4. Add to `core.carinaai.uk/.env.example`:

```bash
HOSTED_MODE=true
CARINA_OPERATOR_HOSTS=core.carinaai.uk,localhost
CARINA_OPS_PRODUCT_ENABLED=true
STRIPE_PRICE_CARINA_OPS_STARTER=price_placeholder_starter
STRIPE_PRICE_CARINA_OPS_TEAM=price_placeholder_team
```

5. Wire `CARINA_OPS_PRODUCT_ENABLED` into `src/config/index.ts` under `config.hosted` or a new `config.carinaOps` block (boolean, default false).

6. Update `subscriptions` plan CHECK in both migration files to include `carina_ops_starter` and `carina_ops_team` when you touch migrations next; for this sprint, add a commented TODO if altering CHECK is deferred.

## Expected behavior

- `/ai-platform` routes are explicitly tagged internal
- Plan catalog includes Carina Ops Starter and Team alongside Scout plans
- Feature limits are defined in one shared module
- Env example documents all Carina Ops product flags

## Test

```bash
cd ops.carinaai.uk && pnpm test
cd core.carinaai.uk && pnpm typecheck
```

Add unit test in `core.carinaai.uk/src/hosted/plan-features.test.ts`:

- `normalizePlanId('carina_ops_starter')` returns starter
- free tier has `opsConsole: false`
- starter tier has `opsConsole: true`, `maxMembers: 3`

## Do not do in this task

- Org schema migrations
- Customer UI
- Marketing site changes
- Stripe product creation (manual ops step; document in runbook only)
