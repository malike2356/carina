# Carina Ops Sprint 5.6: Trial support

## Goal

14-day Team trial for new orgs without immediate payment.

## Context

- Column `subscriptions.trial_ends_at` exists in ops migrations patch
- `plan-gates.ts` stubbed trial handling in prompt 13

## Dependencies

- `24-billing-plan-ids.md`
- `26-stripe-webhook-plan-sync.md`

## Files to modify

- `core.carinaai.uk/src/hosted/plan-gates.ts`
- `core.carinaai.uk/src/hosted/org-service.ts`
- `core.carinaai.uk/src/api/carina-ops-routes.ts`
- `core.carinaai.uk/src/gateway/web/ops/billing.html`

## Step-by-step

1. On `createOrgForUser()`, set:

```typescript
trial_ends_at: new Date(Date.now() + 14 * 86400000)
```

And `organizations.plan = 'carina_ops_team'` during trial OR use virtual elevation in `getOrgPlan()`.

2. Prefer virtual elevation in `getOrgPlan()`:

- If `trial_ends_at > now()` and paid plan is `free`, return effective plan `carina_ops_team`
- Do not mutate stored plan until checkout

3. Show trial banner in ops shell:

```text
Team trial: X days left. Add billing to keep access.
```

4. When trial expires without payment:

- `getOrgPlan()` returns `free`
- Ops console returns 402

5. Checkout during trial converts to paid without losing data.

6. Audit: `billing.trial_started`, `billing.trial_expired`.

## Expected behavior

- New org gets 14 days of Team features
- Day 15 without payment blocks ops console
- Stripe checkout ends trial and sets paid plan

## Test

```bash
cd core.carinaai.uk && pnpm test src/hosted/plan-gates.test.ts
```

Cases: active trial elevates plan; expired trial does not.

## Exit criteria

Sprint 5 complete: stranger can checkout; plan gates change behavior.
