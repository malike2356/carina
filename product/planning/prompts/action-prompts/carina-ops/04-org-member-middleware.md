# Carina Ops Sprint 1.4: Org member middleware

## Goal

Add Express middleware that resolves org context from session/JWT and enforces RBAC on protected routes.

## Context

- Hosted session: `req.session.hostedAccountId`, `hostedOrgId`, `hostedOrgRole` (from prompt 02)
- Existing hosted auth: `src/gateway/web-auth.ts` (`requireHostedAuth`, `redirectIfHostedAuthed`)
- Customer Carina Ops routes use `/api/carina-ops/*` (not `/api/ops/*` which is operator machine API)

## Dependencies

- `02-register-creates-org.md`
- `03-rbac-module.md`

## Files to modify

- `core.carinaai.uk/src/gateway/web-auth.ts`
- `core.carinaai.uk/src/types/web-session.d.ts`

## Files to create

- `core.carinaai.uk/src/hosted/org-context.ts`
- `core.carinaai.uk/src/hosted/org-context.test.ts`

## Step-by-step

1. Extend `SessionData` in `web-session.d.ts`:

```typescript
hostedOrgId?: string;
hostedOrgRole?: OrgRole;
```

2. Create `org-context.ts`:

```typescript
export interface OrgContext {
  userId: string;
  orgId: string;
  role: OrgRole;
  email: string;
}

export function getOrgContext(req: Request): OrgContext | null;
export function requireOrgContext(req: Request, res: Response): OrgContext | null;
```

3. Add middleware factory in `web-auth.ts`:

```typescript
export function requireOrgMember(action: RbacAction) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ctx = requireOrgContext(req, res);
    if (!ctx) return;
    if (!canPerform(ctx.role, action)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    (req as Request & { orgContext: OrgContext }).orgContext = ctx;
    next();
  };
}
```

4. Add `requireHostedSession` that ensures `hostedAccountId` and `hostedOrgId` are set; if org missing, attempt `getPrimaryOrgForUser()` and populate session.

5. Export typed request helper:

```typescript
export function orgContext(req: Request): OrgContext;
```

6. Tests for middleware using supertest or mock req/res:

- missing session returns 401
- viewer blocked on write action returns 403
- operator allowed on workbench.run passes through

## Expected behavior

- All future `/api/carina-ops/*` routes use `requireHostedSession` + `requireOrgMember(action)`
- Org context is available on `req.orgContext` without re-querying DB per handler

## Test

```bash
cd core.carinaai.uk && pnpm test src/hosted/org-context.test.ts
```

Manual: login on `app.carinaai.uk`, confirm session cookie includes org after register.
