# Carina Ops Sprint 6.3: Audit and usage CSV exports

## Goal

Team-plan CSV exports for audit log and usage data.

## Context

- Gated by `exports` feature in plan-features (Team only)
- Retention filters apply same as read APIs

## Dependencies

- `21-ops-usage-credits-api.md`
- `22-ops-audit-log-api.md`
- `13-plan-gates-module.md`

## Files to modify

- `core.carinaai.uk/src/api/carina-ops-routes.ts`
- `core.carinaai.uk/src/hosted/product-audit.ts`
- `core.carinaai.uk/src/hosted/usage-service.ts`
- `core.carinaai.uk/src/gateway/web/ops/audit.html`
- `core.carinaai.uk/src/gateway/web/ops/usage.html`

## Step-by-step

1. Routes:

- `GET /api/carina-ops/audit/export?format=csv`
- `GET /api/carina-ops/usage/export?format=csv&days=30`

2. Require `exports` feature (Team); Starter gets 402.

3. CSV columns:

Audit: `id,action,actor_email,resource_type,resource_id,created_at,details_json`

Usage: `date,model,tokens_used,cost_estimate`

4. Set headers:

```typescript
res.setHeader('Content-Type', 'text/csv');
res.setHeader('Content-Disposition', `attachment; filename="carina-ops-audit-${orgId}.csv"`);
```

5. Stream rows; do not load unbounded history into memory (limit 10k rows).

6. Audit `exports.audit_downloaded` and `exports.usage_downloaded`.

7. Add Export buttons on audit and usage pages (Team badge).

## Expected behavior

- Team user downloads CSV with correct columns
- Starter user gets upgrade_required
- Exported details contain no raw API keys

## Test

```bash
cd core.carinaai.uk && pnpm test src/api/carina-ops-routes.test.ts
```

Assert CSV content-type and row count; redaction test on audit export.
