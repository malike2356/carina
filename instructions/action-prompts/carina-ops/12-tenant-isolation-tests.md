# Carina Ops Sprint 2.5: Tenant isolation test suite

## Goal

Automated tests proving cross-tenant reads and forbidden actions fail across vault, usage, and audit.

## Context

- This is the Sprint 2 exit gate; do not start Sprint 4 features until this passes
- Follow TDD; tests may start failing until prompts 09-10 complete

## Dependencies

- `09-scope-billing-byok-queries.md`
- `10-product-audit-log.md`

## Files to create

- `core.carinaai.uk/src/api/__tests__/hosted-isolation.test.ts`

## Files to modify

- `core.carinaai.uk/prompts/hosted-saas-multitenancy.md` (add automated test reference)

## Step-by-step

1. Test setup creates two complete tenants:

- Org A: userA (owner), usage rows, vault key, audit events
- Org B: userB (owner), separate data

2. Required cases:

```text
userA GET vault keys does not include org B providers
userA GET usage does not include org B tokens
userA GET audit does not include org B events
userA cannot pass orgB uuid in query string to bypass (403 or empty)
operator in org A cannot invite to org B
viewer in org A cannot POST workbench (403) [use probe or stub route]
listProductAudit(orgA) count excludes orgB rows
```

3. Separate file `ops.carinaai.uk/lib/tenant-isolation.test.ts` (optional):

- ops admin route with tenantId param returns correct tenant only

4. Update `hosted-saas-multitenancy.md` manual section:

```markdown
Automated: pnpm test src/api/__tests__/hosted-isolation.test.ts
Manual smoke: still recommended before release
```

## Expected behavior

- CI fails if any query drops org_id filter
- Test file runs in under 30 seconds with mocks

## Test

```bash
cd core.carinaai.uk && pnpm test src/api/__tests__/hosted-isolation.test.ts
```

## Exit criteria

Sprint 2 complete when isolation suite is green and `hosted-rbac.test.ts` still passes.
