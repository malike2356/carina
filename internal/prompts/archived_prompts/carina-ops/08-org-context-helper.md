# Carina Ops Sprint 2.1: Org context helper and query scoping utilities

## Goal

Centralize org-scoped database access so every product query uses the same `org_id` filter.

## Context

- `getOrgContext(req)` from prompt 04
- Today many queries use `tenant_id = accountId` (user id); migrate to `org_id`
- Read `src/brain/tenant-provider-keys.ts` and `src/api/hosted-billing.ts`

## Dependencies

- `04-org-member-middleware.md`

## Files to create

- `core.carinaai.uk/src/hosted/scoped-query.ts`
- `core.carinaai.uk/src/hosted/scoped-query.test.ts`

## Files to modify

- `core.carinaai.uk/src/hosted/org-context.ts` (export `assertOrgId`)

## Step-by-step

1. Create `scoped-query.ts`:

```typescript
export function orgWhereClause(alias?: string): string;
// returns "org_id = $1" or "t.org_id = $1"

export async function queryForOrg<T>(
  orgId: string,
  sql: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>>;

export function rejectMissingOrgId(orgId: string | undefined): asserts orgId is string;
```

2. Add helper to map legacy `tenant_id` to `org_id` during transition:

```typescript
export async function resolveOrgIdFromUser(userId: string): Promise<string | null>;
```

3. Middleware enhancement: store `orgId` on `req.orgContext` always; throw 400 if session has user but no org (prompt backfill).

4. Document in file header: **every** `SELECT/UPDATE/DELETE` on product tables must use `queryForOrg`.

## Expected behavior

- `queryForOrg('uuid', 'SELECT * FROM usage_records WHERE org_id = $1', [orgId])` is the standard pattern
- Missing orgId throws before query runs

## Test

```bash
cd core.carinaai.uk && pnpm test src/hosted/scoped-query.test.ts
```

## Pitfalls

- Never concatenate orgId into SQL strings; always parameterize
