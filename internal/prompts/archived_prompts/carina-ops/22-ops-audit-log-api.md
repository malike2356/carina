# Carina Ops Sprint 4.6: Product audit log API

## Goal

Customer-facing audit log viewer at `/api/carina-ops/audit` with retention enforced by plan.

## Context

- `product_audit_log` from prompt 10
- Retention days from `plan-features.ts`

## Dependencies

- `10-product-audit-log.md`
- `15-carina-ops-api-router.md`

## Files to modify

- `core.carinaai.uk/src/hosted/product-audit.ts` (add retention filter)
- `core.carinaai.uk/src/api/carina-ops-routes.ts`
- `core.carinaai.uk/src/gateway/web/ops/audit.html`

## Step-by-step

1. Extend `listProductAudit`:

```typescript
export async function listProductAuditForPlan(
  orgId: string,
  plan: PlanTier,
  opts?: { limit?: number; cursor?: string },
): Promise<{ events: AuditRow[]; nextCursor?: string }>;
```

Filter `created_at >= now() - retentionDays(plan)`.

2. Route `GET /audit?limit=50&cursor=`:

- require `audit.read`
- return `{ events: [{ id, action, actorEmail, resourceType, createdAt, details }] }`
- `actorEmail` joined from `hosted_users`; never expose internal ops actor

3. `audit.html`: table with action, actor, time, expandable details (redacted JSON).

4. Pagination via cursor (created_at + id).

## Expected behavior

- Starter sees 30 days; free tier blocked from ops console entirely
- Secrets never appear in details column

## Test

Add audit list test with old events outside retention excluded.

```bash
cd core.carinaai.uk && pnpm test src/hosted/product-audit.test.ts
```
