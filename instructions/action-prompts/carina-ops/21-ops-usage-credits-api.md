# Carina Ops Sprint 4.5: Usage and credits API

## Goal

Expose org-level usage charts and credit balance at `/api/carina-ops/usage` and `/api/carina-ops/credits`.

## Context

- `usage_records` table; aggregation in `hosted-billing.ts`
- Credits UI prototype in `ops.carinaai.uk/views/ai-platform/credits.ejs`
- v1: read-only credits from org plan limits; manual top-up stays in ops back office

## Dependencies

- `09-scope-billing-byok-queries.md`
- `15-carina-ops-api-router.md`

## Files to create

- `core.carinaai.uk/src/hosted/usage-service.ts`

## Files to modify

- `core.carinaai.uk/src/api/carina-ops-routes.ts`
- `core.carinaai.uk/src/gateway/web/ops/usage.html`
- `core.carinaai.uk/src/gateway/web/ops/index.html` (usage summary)

## Step-by-step

1. `usage-service.ts`:

```typescript
export async function getUsageSummary(orgId: string, days?: number): Promise<UsageSummary>;
export async function getUsageByModel(orgId: string, days?: number): Promise<ModelUsage[]>;
export async function getCreditsStatus(orgId: string): Promise<CreditsStatus>;
```

2. `UsageSummary`: `{ totalTokens, totalCost, daily: [{ date, tokens, cost }] }`

3. `CreditsStatus`: `{ monthlyLimit, usedThisMonth, remaining, percentUsed, warning: boolean }`

4. Warning when `percentUsed >= 80`.

5. Routes:

- `GET /usage?days=30` require `usage.read`
- `GET /credits` require `usage.read`

6. `usage.html`: simple bar chart or table by day (vanilla JS, no chart library required).

## Expected behavior

- Usage scoped to org only
- Overview page shows today's tokens and cost
- 80% usage shows warning badge

## Test

```bash
cd core.carinaai.uk && pnpm test src/hosted/usage-service.test.ts
```
