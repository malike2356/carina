# Carina Ops Sprint 2.4: Ops support tenant scoping and audit

## Goal

Harden `ops.carinaai.uk` tenant support routes so cross-tenant access requires explicit tenant ID and is always audited.

## Context

- Ops is VERLOX private; admins may view any tenant
- Risk: accidental global queries on memories, skills, chat (out of scope here)
- Focus: `routes/tenants.ts`, `lib/tenant-byok.ts`, `lib/tenant-audit.ts`

## Dependencies

- `08-org-context-helper.md`
- `10-product-audit-log.md`

## Files to modify

- `ops.carinaai.uk/routes/tenants.ts`
- `ops.carinaai.uk/lib/tenant-audit.ts`
- `ops.carinaai.uk/views/tenant-detail.ejs`

## Step-by-step

1. Every tenant detail route must validate UUID `tenantId` param; return 404 if not found in `hosted_users`.

2. Extend `writeOpsAudit()` in `tenant-audit.ts`:

```typescript
export async function writeOpsAudit(entry: {
  tenantId?: string;
  orgId?: string;
  action: string;
  actor?: string;
  details?: Record<string, unknown>;
}): Promise<void>;
```

3. Log these actions at minimum:

- `tenant.view`
- `tenant.plan_override`
- `tenant.byok.view`
- `tenant.suspend`
- `tenant.impersonate_start` (stub for prompt 34)

4. BYOK section in tenant detail: show provider list only; never render decrypted key in HTML.

5. Add banner on tenant detail: "Internal support view. Not customer Carina Ops."

6. Add test in `ops.carinaai.uk/lib/tenant-audit.test.ts` for new action labels.

## Expected behavior

- Opening `/tenants/:id` writes `tenant.view` audit row
- Invalid tenant UUID returns 404 not 500
- BYOK UI never shows raw API key

## Test

```bash
cd ops.carinaai.uk && pnpm test
```

Manual: open tenant detail locally; confirm audit log row in `ops_audit_log`.
