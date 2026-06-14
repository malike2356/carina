# Carina Ops Sprint 2.3: Product audit log table and writer

## Goal

Create durable `product_audit_log` for customer-visible events separate from `ops_audit_log`.

## Context

- `ops_audit_log` in ops is for VERLOX admin actions
- Customer audit needs: org_id, actor_user_id, action, details (redacted), created_at
- Events listed in implementation plan Sprint 4

## Dependencies

- `08-org-context-helper.md`

## Files to create

- `core.carinaai.uk/src/hosted/product-audit.ts`
- `core.carinaai.uk/src/hosted/product-audit.test.ts`

## Files to modify

- `core.carinaai.uk/src/api/hosted-migrations.ts`
- `ops.carinaai.uk/lib/hosted-migrations.ts`

## Step-by-step

1. Add migration:

```sql
CREATE TABLE IF NOT EXISTS product_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES hosted_users(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB NOT NULL DEFAULT '{}',
  ip_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_audit_org_created
  ON product_audit_log (org_id, created_at DESC);
```

2. Create `product-audit.ts`:

```typescript
export interface AuditEventInput {
  orgId: string;
  actorUserId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  req?: Request;
}

export async function writeProductAudit(event: AuditEventInput): Promise<void>;
export async function listProductAudit(
  orgId: string,
  opts?: { limit?: number; since?: Date; action?: string },
): Promise<AuditRow[]>;
```

3. Redaction in `writeProductAudit`:

- Strip keys matching `/api[_-]?key|secret|password|token/i` from details
- Truncate string values over 500 chars

4. Wire audit calls into invite accept (prompt 05) and future vault/workbench handlers.

## Expected behavior

- `writeProductAudit({ action: 'org.member_invited', ... })` persists redacted JSON
- `listProductAudit(orgId)` returns only that org's events newest first

## Test

```bash
cd core.carinaai.uk && pnpm test src/hosted/product-audit.test.ts
```

Cases: redaction removes apiKey field, org filter works, empty details default `{}`.
