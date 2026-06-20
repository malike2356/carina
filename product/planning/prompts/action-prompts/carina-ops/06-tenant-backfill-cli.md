# Carina Ops Sprint 1.6: Tenant backfill CLI

## Goal

Backfill `organizations` and `org_memberships` for existing `hosted_users` rows that predate the org model.

## Context

- Production may already have `hosted_users` without org rows
- CLI pattern: `core.carinaai.uk/src/cli/commands/hosted-cli.ts`
- `createOrgForUser()` from `org-service.ts` should be reusable

## Dependencies

- `01-org-migrations-schema.md`
- `02-register-creates-org.md`

## Files to modify

- `core.carinaai.uk/src/cli/commands/hosted-cli.ts`
- `bin/carina.ts` (register subcommand if needed)

## Files to create

- `core.carinaai.uk/src/hosted/org-backfill.ts`
- `core.carinaai.uk/src/hosted/org-backfill.test.ts`

## Step-by-step

1. Create `org-backfill.ts`:

```typescript
export async function listUsersWithoutOrg(): Promise<Array<{ id: string; email: string }>>;
export async function backfillOrgForUser(userId: string): Promise<{ orgId: string; created: boolean }>;
export async function backfillAllOrgs(): Promise<{ created: number; skipped: number; errors: string[] }>;
```

2. For each user without membership:

- Call `createOrgForUser(userId, email)`
- Set `subscriptions.org_id` and `usage_records.org_id` where `tenant_id = userId`
- Set `tenant_provider_keys.org_id` similarly

3. Add CLI command:

```bash
pnpm carina hosted backfill-orgs [--dry-run] [--user-id=UUID]
```

4. Dry run prints what would be created without writing.

5. Log summary to stdout; errors per user do not abort entire batch.

## Expected behavior

- Running backfill on empty DB is no-op
- User with no org gets one org named from email
- Re-run is idempotent (skipped count increases)
- `subscriptions.org_id` populated for legacy tenants

## Test

```bash
cd core.carinaai.uk && pnpm test src/hosted/org-backfill.test.ts
```

Integration: create hosted_user without org in test DB, run backfill, assert membership exists.

## Pitfalls

- Run on staging before production
- Keep `tenant_id` column; do not rename to `org_id` only in this sprint
