# Carina Ops Sprint 1.3: RBAC permission module

## Goal

Create a single RBAC module that maps org roles to allowed actions for all Carina Ops APIs.

## Context

- Roles: `owner`, `admin`, `operator`, `auditor`, `viewer`
- Permission matrix is in `CARINA_OPS_IMPLEMENTATION_PLAN.md` Sprint 1
- No RBAC exists today; ops uses one admin password

## Dependencies

- `01-org-migrations-schema.md`

## Files to create

- `core.carinaai.uk/src/hosted/rbac.ts`
- `core.carinaai.uk/src/hosted/rbac.test.ts`

## Files to modify

None required beyond exports if an index file exists.

## Step-by-step

1. Define action constants:

```typescript
export type RbacAction =
  | 'org.settings.read'
  | 'org.settings.write'
  | 'org.members.invite'
  | 'org.members.remove'
  | 'vault.read'
  | 'vault.write'
  | 'workbench.run'
  | 'usage.read'
  | 'audit.read'
  | 'billing.read'
  | 'billing.write'
  | 'deployments.read'
  | 'exports.run';
```

2. Build `ROLE_PERMISSIONS: Record<OrgRole, Set<RbacAction>>`:

| Action | owner | admin | operator | auditor | viewer |
|--------|-------|-------|----------|---------|--------|
| org.settings.write | yes | yes | no | no | no |
| org.members.invite | yes | yes | no | no | no |
| vault.write | yes | yes | no | no | no |
| workbench.run | yes | yes | yes | no | no |
| usage.read | all | all | all | all | all |
| audit.read | all | all | all | all | all |
| billing.write | owner only | no | no | no | no |

3. Export helpers:

```typescript
export function canPerform(role: OrgRole, action: RbacAction): boolean;
export function assertCanPerform(role: OrgRole, action: RbacAction): void; // throws ForbiddenError
export function minRoleFor(action: RbacAction): OrgRole[];
```

4. Add `ForbiddenError` class in `src/hosted/errors.ts` with `statusCode = 403`.

5. Write exhaustive tests: every action tested for allowed and denied roles.

## Expected behavior

- `canPerform('viewer', 'workbench.run')` is false
- `canPerform('operator', 'vault.write')` is false
- `canPerform('owner', 'billing.write')` is true
- `canPerform('admin', 'billing.write')` is false

## Test

```bash
cd core.carinaai.uk && pnpm test src/hosted/rbac.test.ts
```

Coverage: at least one allowed and one denied case per action.
