# Carina Ops Sprint 1.7: RBAC integration tests

## Goal

Prove role boundaries on real HTTP endpoints before building more features.

## Context

- Middleware from prompt 04
- Invites from prompt 05
- Use Vitest + express test server pattern from `ops-routes.test.ts`

## Dependencies

- `03-rbac-module.md`
- `04-org-member-middleware.md`
- `05-org-invites-endpoints.md`

## Files to create

- `core.carinaai.uk/src/api/__tests__/hosted-rbac.test.ts`

## Files to modify

- `core.carinaai.uk/src/api/hosted-web.ts` (add temporary probe routes if needed for testing)

## Step-by-step

1. Create test harness that mounts `hosted-web` routes with in-memory or test Postgres (follow `hosted-auth.test.ts` mocking style).

2. Seed four users in same org: owner, admin, operator, viewer (use direct SQL inserts in test setup).

3. Required test cases (minimum 12):

```text
owner can POST /app/auth/org/invites
viewer cannot POST /app/auth/org/invites (403)
admin can POST /app/auth/org/invites
operator cannot POST /app/auth/org/invites (403)
owner can access billing.write probe (200)
admin cannot access billing.write probe (403)
operator can access workbench.run probe (200)
viewer cannot access workbench.run probe (403)
auditor can GET usage.read probe (200)
auditor cannot POST vault.write probe (403)
unauthenticated requests return 401
JWT with wrong orgId cannot access another org resource (403)
```

4. Add lightweight probe routes guarded by `requireOrgMember` only in test env OR test against invite endpoints directly.

5. Document role matrix in test file header comment.

## Expected behavior

- All 12+ tests pass
- Any new protected route must add a corresponding RBAC test before merge

## Test

```bash
cd core.carinaai.uk && pnpm test src/api/__tests__/hosted-rbac.test.ts
```

## Exit criteria

This prompt completes Sprint 1 when combined with prompts 01-06 passing.
