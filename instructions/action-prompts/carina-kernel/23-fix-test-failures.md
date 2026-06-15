# Carina Kernel: Fix 13 failing tests

## Goal

Fix all failing tests so `pnpm test` returns zero failures. As of 14 June 2026 there are
10 failing test files and 13 failing assertions. Each failure has a specific, known cause
documented below. Fix them in order; run `pnpm test` after each group to confirm.

## Context

- Working directory: `core.carinaai.uk/`
- Test runner: Vitest (`pnpm test`)
- Current state: 7891 tests, 13 failing
- All failures are in pre-existing test files; the tests themselves are correct.
  The production code diverged from what the tests expect.

## Dependencies

None. Run this before any other kernel prompt.

## Failures and fixes

---

### Group 1: Two unregistered tools (4 tests across 2 files)

**Failing tests:**
- `src/tools/tool-security-regression.test.ts` - "classifies every registered tool in TOOL_RISK_REGISTRY"
- `src/tools/tool-security-regression.test.ts` - "marks leak-prone tools with dangerous flag"
- `src/tools/tool-policy-matrix.test.ts` - "has no unregistered tools in the risk registry"
- `src/tools/tool-policy-matrix.test.ts` - "reports audit summary with high-risk inventory"

**Exact error:**
```
AssertionError: add to tool-risk-registry.ts: email-smtp-send, generate-pdf
```

**Root cause:** Two tools (`email-smtp-send` and `generate-pdf`) were added to the tool
registry but never added to `TOOL_RISK_REGISTRY` in `src/tools/tool-risk-registry.ts`.

**Fix:**

Read `src/tools/tool-risk-registry.ts`. Find the `TOOL_RISK_REGISTRY` object.
Add two entries in the correct section:

In the Write section (alongside `email-send`):
```typescript
'email-smtp-send': {
  riskClass: 'write',
  sideEffects: ['sends outbound email via SMTP relay'],
  requiresDangerousFlag: true,
},
```

In the Write section (alongside `file-write`):
```typescript
'generate-pdf': {
  riskClass: 'write',
  sideEffects: ['writes PDF file to disk or memory'],
  requiresDangerousFlag: false,
},
```

Then find the actual `email-smtp-send` tool file (search `src/tools/` for the tool
definition) and confirm whether it already has `dangerous: true` set on the tool object.
If not, add it. Same for `generate-pdf`.

**Verify:** `pnpm test src/tools/tool-security-regression.test.ts src/tools/tool-policy-matrix.test.ts`

---

### Group 2: Missing `src/gateway/web.ts` (2 tests across 2 files)

**Failing tests:**
- `src/gateway/acp.test.ts` - "web still imports setupAcpRoutes but routes self-gate"
- `src/infrastructure/node-host/runtime-isolation.test.ts` - "gateway only mounts node routes when env flag is set"

**Exact error:**
```
Error: ENOENT: no such file or directory, open '.../src/gateway/web.ts'
```

**Root cause:** Both tests use `fs.readFileSync` on `src/gateway/web.ts` to inspect the
source text. The web module was renamed or moved during the package extraction work and
`web.ts` no longer exists at that path.

**Fix:**

1. Search for the current location of the web gateway entry point:
   ```bash
   find src/gateway -name "*.ts" | head -20
   grep -r "setupAcpRoutes\|startWeb" src/gateway/ --include="*.ts" -l
   ```

2. If the file was renamed (e.g., to `web-server.ts` or `server.ts`):
   - Create `src/gateway/web.ts` as a re-export barrel:
     ```typescript
     export * from './web-server.js';
     ```
   - Confirm `setupAcpRoutes` is imported or re-exported through this file so the test's
     `toMatch(/setupAcpRoutes/)` check passes.

3. If the file was moved to `packages/web/`:
   - The test file itself needs updating to point at the new path. Read the test to
     understand what `srcRoot` resolves to and update accordingly.

4. For `runtime-isolation.test.ts`: it also reads `web.ts` to check for an env flag
   guard. Confirm the web entry point contains a check like:
   ```typescript
   if (process.env.CARINA_NODE_HOST !== 'true') return;
   ```
   or equivalent. If not, add it.

**Verify:** `pnpm test src/gateway/acp.test.ts src/infrastructure/node-host/runtime-isolation.test.ts`

---

### Group 3: Plugin loader expects `.ts` but finds `.js` (1 test)

**Failing test:**
- `src/plugins/loader.test.ts` - "discovers github-copilot plugin file on disk"

**Exact error:**
```
AssertionError: expected [ 'github-copilot.js' ] to include 'github-copilot.ts'
```

**Root cause:** `listProviderPluginFiles` returns compiled `.js` output filenames but the
test expects TypeScript source `.ts` filenames. The function is scanning the built `dist/`
directory or the source directory has no `.ts` files (only compiled output).

**Fix:**

Read `src/plugins/loader.ts`. Find `listProviderPluginFiles`. Determine whether it scans:
- The source `src/plugins/` directory (should find `.ts`)
- The built `dist/plugins/` directory (finds `.js`)

If it scans `dist/`:
- Update `listProviderPluginFiles` to scan the source directory when `NODE_ENV !== 'production'`
  OR update the file extension filter to include `.ts`:
  ```typescript
  return files.filter((f) => f.endsWith('.ts') || f.endsWith('.js'));
  ```
  Then sort to prefer `.ts` over `.js` for the same base name.

If `github-copilot.ts` is genuinely missing (only `.js` exists in source):
- Check `git log --follow -- src/plugins/github-copilot.ts` to see if it was deleted
- If deleted, restore it or rename the `.js` to `.ts` and ensure it compiles

**Verify:** `pnpm test src/plugins/loader.test.ts`

---

### Group 4: Missing `getSessionTool` in tool mock (1 test)

**Failing test:**
- `src/security/tool-policy-middleware.test.ts` - "does not call ToolPolicyEnforcer.enforce when Labyrinth is disabled"

**Exact error:**
```
Error: [vitest] No "getSessionTool" export is defined on the "../tools/index.js" mock.
```

**Root cause:** The mock factory for `../tools/index.js` in this test file does not include
`getSessionTool` in its return object, but the module being tested now imports and calls
`getSessionTool` from that module.

**Fix:**

Read `src/security/tool-policy-middleware.test.ts`. Find the `vi.mock('../tools/index.js', ...)` call.

Add `getSessionTool` to the mock return object:
```typescript
vi.mock('../tools/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../tools/index.js')>();
  return {
    ...actual,
    getSessionTool: vi.fn(() => undefined),
    // ... existing mocked exports
  };
});
```

Read the actual `src/tools/index.ts` to confirm the real signature of `getSessionTool`,
then match it in the mock (return type, parameters).

**Verify:** `pnpm test src/security/tool-policy-middleware.test.ts`

---

### Group 5: Hosted quota logic broken (2 tests)

**Failing tests:**
- `src/api/__tests__/hosted-quota.test.ts` - "blocks workbench usage at 100 percent"
- `src/api/__tests__/hosted-quota.test.ts` - "warns at 80 percent without blocking"

**Exact errors:**
```
expected quota.allowed to be false   (got true)   -- at 100% usage
expected quota.warning to be true    (got false)   -- at 80% usage
```

**Root cause:** `checkOrgUsageQuota` in `src/api/hosted-billing.ts` is not correctly
comparing `used` against the plan limit. The function either:
- Is not reading `used` from the right field in the DB response
- Has the comparison direction wrong (e.g., `>` vs `>=`)
- Is not setting `warning: true` when `used / limit >= 0.8`

**Fix:**

Read `src/api/hosted-billing.ts`. Find `checkOrgUsageQuota`. The logic must be:

```typescript
const limit = getPlanLimit(plan); // e.g. 500_000 for starter
const used = Number(row.total ?? 0); // from SUM(tokens_used)

return {
  allowed: used < limit,                  // false when used >= limit
  warning: used >= limit * 0.8 && used < limit,
  used,
  limit,
};
```

The test mock returns `'500000'` (string) for `org-over` and `'420000'` for `org-warn`.
The `Number()` cast is required; if the code uses `parseInt` or direct comparison on the
string it may malfunction.

Also confirm `getPlanLimit('carina_ops_starter')` returns `500_000`. If the plan name or
limit value is wrong, adjust to match the test mock's expectation.

**Verify:** `pnpm test src/api/__tests__/hosted-quota.test.ts`

---

### Group 6: Hosted isolation (1 test)

**Failing test:**
- `src/api/__tests__/hosted-isolation.test.ts` - "userA usage does not include org B tokens"

**Fix:**

Read the full test file. The test sets up two orgs (org-a, org-b) each with token usage
records and confirms that querying org-a returns only org-a tokens (1000, not 10000).

Read the function being tested (likely in `src/hosted/scoped-query.ts` or
`src/api/hosted-billing.ts`). Confirm the SQL query filters by `org_id` correctly.

Common causes:
- Missing `WHERE org_id = $1` clause (returns all rows, sums both orgs)
- Using `OR` instead of `AND` in the org/tenant filter
- `orgOrTenantWhere()` helper constructing the wrong predicate

Find the bug by reading the mock's filter logic in the test vs the actual SQL in production
code. Fix the WHERE clause so it returns only the requesting org's data.

**Verify:** `pnpm test src/api/__tests__/hosted-isolation.test.ts`

---

### Group 7: Ops skill pack save returns 500 (1 test)

**Failing test:**
- `src/api/ops-routes.test.ts` - "saves valid skill packs for ops"

**Exact error:**
```
expected 500 to be 200
```

**Root cause:** The ops API route for saving skill packs is throwing an unhandled exception.

**Fix:**

Run the test in isolation and capture the 500 response body:

Read `src/api/ops-routes.ts`. Find the route handler for the skill packs save endpoint
(likely `POST /ops/skill-packs` or similar). Look for:
- Unhandled promise rejection (missing `try/catch`)
- A dependency (`db`, `config`, `fileStore`) that is not mocked in the test environment
- A validation error on the `packs` payload (`['finance']` in the test) that throws instead
  of returning a 400

The test sends `{ packs: ['finance'], actor: 'test', source: 'test' }`. If the handler
tries to write to disk or database without the test setting up those dependencies, it
will 500.

Fix by:
1. Wrapping the handler in try/catch and returning a proper error response instead of
   letting Express default to 500
2. OR ensuring the handler's dependencies are properly injectable/mockable
3. Confirm `'finance'` is a valid pack name that passes any pack name validation

**Verify:** `pnpm test src/api/ops-routes.test.ts`

---

## Final verification

After all groups are fixed:

```bash
cd core.carinaai.uk
pnpm test
```

Expected result:
```
Test Files  266 passed (266)
     Tests  7891 passed (7891)
```

If any test file still fails after the targeted fix, read its full error output, trace the
production code path it exercises, and fix the underlying logic. Do not skip or modify
test assertions to make tests pass; fix the production code.

## Pitfalls

- `tool-risk-registry.ts` entries must be in alphabetical order within each section;
  the audit function may depend on sorted iteration
- When adding `dangerous: true` to a tool object, confirm the tool's TypeScript type
  allows the `dangerous` property; if not, the type must be updated too
- The hosted quota fix must not break the existing passing tests in the same file; run
  the full file after each change
