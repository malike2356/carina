# Carina Ops Sprint 2.2: Scope billing and BYOK queries by org

## Goal

Ensure usage, subscriptions, and vault keys are only readable within the caller's organization.

## Context

- `tenant_provider_keys` table; encryption in `src/brain/tenant-provider-keys.ts`
- Billing: `src/api/hosted-billing.ts`, `src/billing/subscription-manager.ts`
- Ops panel BYOK: `ops.carinaai.uk/lib/tenant-byok.ts` (internal only; add org_id filter for support reads)

## Dependencies

- `08-org-context-helper.md`

## Files to modify

- `core.carinaai.uk/src/api/hosted-billing.ts`
- `core.carinaai.uk/src/brain/tenant-provider-keys.ts`
- `core.carinaai.uk/src/api/tenant-keys.ts` (if exists)
- `ops.carinaai.uk/lib/tenant-byok.ts`
- `ops.carinaai.uk/routes/tenants.ts`

## Step-by-step

1. Update `listTenantProviders(tenantId)` to accept `orgId` and query:

```sql
SELECT ... FROM tenant_provider_keys WHERE org_id = $1
```

Fall back to `tenant_id` only when `org_id IS NULL` during migration (document removal date).

2. Update usage aggregation in `hosted-billing.ts`:

```sql
SELECT ... FROM usage_records WHERE org_id = $1 AND date >= $2
```

3. Subscription reads filter by `org_id` not raw `tenant_id = userId`.

4. In ops `tenant-byok.ts`, `listProviderKeys(tenantId)` must join through org:

```sql
SELECT k.* FROM tenant_provider_keys k
JOIN organizations o ON o.id = k.org_id
JOIN hosted_users u ON u.id = o.owner_user_id
WHERE u.id = $1 OR k.org_id = (SELECT org_id FROM org_memberships WHERE user_id = $1 LIMIT 1)
```

For ops support, require explicit `tenantId` query param and log to `ops_audit_log`.

5. Never return `encrypted_api_key` to customer APIs; mask as `hasKey: true`.

## Expected behavior

- Customer billing usage endpoint returns only their org's rows
- Ops admin viewing tenant BYOK sees redacted keys (provider name + enabled only)
- Cross-org BYOK list returns empty or 403

## Test

Update `hosted-billing.test.ts` with two orgs fixture; assert org A cannot see org B usage.

```bash
cd core.carinaai.uk && pnpm test src/api/__tests__/hosted-billing.test.ts
```
