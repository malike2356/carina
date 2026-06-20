# Carina Ops Sprint 1.2: Register creates organization

## Goal

Every new hosted registration automatically creates an organization and owner membership.

## Context

- `registerUser()` in `core.carinaai.uk/src/api/hosted-auth.ts` currently inserts `hosted_users` and creates a Postgres schema
- `hosted-web.ts` POST `/register` calls `registerUser()` and sets `req.session.hostedAccountId`
- JWT signing is in `signJwt()`; payload currently has `userId` and `email` only

## Dependencies

- `01-org-migrations-schema.md`

## Files to modify

- `core.carinaai.uk/src/api/hosted-auth.ts`
- `core.carinaai.uk/src/api/hosted-web.ts`
- `core.carinaai.uk/src/types/web-session.d.ts` (if session needs orgId)

## Files to create

- `core.carinaai.uk/src/hosted/org-service.ts`
- `core.carinaai.uk/src/hosted/org-service.test.ts`

## Step-by-step

1. Create `org-service.ts` with:

```typescript
export function slugifyOrgName(email: string, displayName?: string): string;
export async function createOrgForUser(
  userId: string,
  email: string,
  orgName?: string,
): Promise<{ orgId: string; slug: string; role: 'owner' }>;
export async function getPrimaryOrgForUser(userId: string): Promise<OrgMembershipRow | null>;
```

2. `createOrgForUser` logic:

- Default org name from email local part or `orgName` param
- Generate unique slug (`acme`, `acme-2` on collision)
- Insert `organizations` with `owner_user_id`, `plan: 'free'`
- Insert `org_memberships` with role `owner`
- Insert `subscriptions` row keyed by `tenant_id = userId` AND set `org_id` to new org
- Return orgId

3. Call `createOrgForUser()` at end of `registerUser()` inside the same transaction if possible; otherwise sequential with rollback on failure.

4. Update `loginUser()` to load primary org via `getPrimaryOrgForUser()` and include in JWT:

```typescript
{ userId, email, orgId, role }
```

Update `verifyJwt()` return type accordingly.

5. On login and register in `hosted-web.ts`, set session fields:

```typescript
req.session.hostedAccountId = userId;
req.session.hostedOrgId = orgId;
req.session.hostedOrgRole = role;
```

6. Extend `getUserProfile()` (if exists) to return `org: { id, name, plan, role }`.

## Expected behavior

- `POST /app/auth/register` creates user + org + owner membership + subscription link
- `POST /app/auth/login` JWT and session include org context
- Re-login for existing user without org is handled by backfill CLI (next prompt dependency)

## Test

`org-service.test.ts`:

- slugify handles collisions
- createOrgForUser inserts org and membership
- getPrimaryOrgForUser returns owner role

`hosted-auth.test.ts` updates:

- register flow mocks org creation
- JWT decode includes orgId and role

```bash
cd core.carinaai.uk && pnpm test src/hosted/org-service.test.ts src/api/__tests__/hosted-auth.test.ts
```
