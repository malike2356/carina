# Carina Ops Sprint 1.5: Organization invite endpoints

## Goal

Allow owners and admins to invite users by email and accept invites to join an org with a scoped role.

## Context

- Table `org_invites` created in prompt 01
- Resend is already used in `hosted-auth.ts` for password reset; reuse pattern
- v1: one org per user; accepting invite moves user to inviter org or creates new user on accept

## Dependencies

- `03-rbac-module.md`
- `04-org-member-middleware.md`

## Files to modify

- `core.carinaai.uk/src/api/hosted-web.ts`
- `core.carinaai.uk/src/api/hosted-auth.ts`

## Files to create

- `core.carinaai.uk/src/hosted/org-invites.ts`
- `core.carinaai.uk/src/api/__tests__/hosted-org-invites.test.ts`

## Step-by-step

1. Create `org-invites.ts`:

```typescript
export async function createInvite(
  orgId: string,
  email: string,
  role: Exclude<OrgRole, 'owner'>,
  invitedBy: string,
): Promise<{ inviteId: string; token: string }>;

export async function acceptInvite(
  token: string,
  userId: string,
): Promise<{ orgId: string; role: OrgRole }>;

export async function listPendingInvites(orgId: string): Promise<InviteRow[]>;
export async function revokeInvite(orgId: string, inviteId: string): Promise<void>;
```

2. Token handling:

- Generate 32-byte random token; store SHA-256 hash in `token_hash`
- Expiry: 7 days
- Single use; set `accepted_at` on success

3. Add routes to `hosted-web.ts` under `/app/auth/org/`:

| Method | Path | RBAC | Body |
|--------|------|------|------|
| POST | `/invites` | org.members.invite | `{ email, role }` |
| GET | `/invites` | org.settings.read | list pending |
| DELETE | `/invites/:id` | org.members.invite | revoke |
| POST | `/invites/accept` | public (logged in) | `{ token }` |

4. On accept:

- Validate token not expired
- Upsert `org_memberships`
- Update session `hostedOrgId` and `hostedOrgRole`
- Write `product_audit_log` event `org.member_joined` (stub OK if audit table not ready)

5. Email (if `RESEND_API_KEY` set): send invite link `https://app.carinaai.uk/hosted-register?invite=TOKEN`

## Expected behavior

- Admin invites `jane@example.com` as `operator`
- Jane registers or logs in and accepts token
- Jane session has role `operator` in org
- Viewer cannot POST `/invites`

## Test

```bash
cd core.carinaai.uk && pnpm test src/api/__tests__/hosted-org-invites.test.ts
```

Cases: create invite, accept valid, reject expired, reject duplicate membership, 403 for viewer.
