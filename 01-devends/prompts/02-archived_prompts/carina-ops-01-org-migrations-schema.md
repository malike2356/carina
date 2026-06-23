# Carina Ops Sprint 1.1: Organization migrations schema

## Goal

Add `organizations`, `org_memberships`, and `org_invites` tables plus `org_id` columns on hosted product tables.

## Context

- Migrations run from `core.carinaai.uk/src/api/hosted-migrations.ts` via `runHostedMigrations()`
- Ops panel mirrors schema in `ops.carinaai.uk/lib/hosted-migrations.ts`
- Today `hosted_users` is 1:1 with tenant; target is org-centric multi-user model
- Read `hosted-migrations.ts` in both packages before editing

## Dependencies

- `00-lock-spec-and-boundaries.md`

## Files to modify

- `core.carinaai.uk/src/api/hosted-migrations.ts`
- `ops.carinaai.uk/lib/hosted-migrations.ts`

## Files to create

- `core.carinaai.uk/src/api/__tests__/hosted-org-migrations.test.ts`

## Step-by-step

1. Add new tables after `hosted_users` in both migration files:

```sql
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES hosted_users(id),
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_memberships (
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES hosted_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','operator','auditor','viewer')),
  invited_by UUID REFERENCES hosted_users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS org_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','operator','auditor','viewer')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON org_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_email ON org_invites (email);
```

2. Add patch statements (idempotent ALTERs) for `org_id` on:

- `subscriptions`
- `usage_records`
- `tenant_provider_keys`
- `invoices`
- `ops_audit_log`

Use `ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id)`.

3. Update `subscriptions.plan` CHECK to include `carina_ops_starter` and `carina_ops_team`.

4. Export types from a new file `core.carinaai.uk/src/hosted/org-types.ts`:

```typescript
export type OrgRole = 'owner' | 'admin' | 'operator' | 'auditor' | 'viewer';
export interface OrganizationRow { id: string; name: string; slug: string; plan: string; }
export interface OrgMembershipRow { orgId: string; userId: string; role: OrgRole; }
```

5. Write migration test that calls `runHostedMigrations()` against a test DB or mocked client and asserts tables exist (follow pattern in `hosted-bootstrap.test.ts`).

## Expected behavior

- Fresh `runHostedMigrations()` creates org tables
- Re-running migrations is idempotent
- Both core and ops migration files stay in sync for shared tables

## Test

```bash
cd core.carinaai.uk && pnpm test src/api/__tests__/hosted-org-migrations.test.ts
cd ops.carinaai.uk && pnpm test
```

## Pitfalls

- Keep `tenant_id` on existing tables during transition; `org_id` is additive until backfill completes
- Do not drop `hosted_users.schema_name`; per-tenant schemas still used by chat
