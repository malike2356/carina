# Carina Ops Sprint 6.4: Email invite flow

## Goal

Send branded invite emails when admins invite org members.

## Context

- Invite creation in prompt 05
- Resend already used in `hosted-auth.ts` for password reset
- From address: `hello@carinaai.uk`

## Dependencies

- `05-org-invites-endpoints.md`

## Files to create

- `core.carinaai.uk/src/hosted/invite-email.ts`

## Files to modify

- `core.carinaai.uk/src/hosted/org-invites.ts`
- `core.carinaai.uk/.env.example` (document `RESEND_API_KEY` required for invites)

## Step-by-step

1. `sendInviteEmail({ to, orgName, role, inviteUrl, inviterEmail })`:

- Subject: `You are invited to ${orgName} on Carina Ops`
- Body: plain text + minimal HTML
- Link: `https://app.carinaai.uk/hosted-register?invite=${token}`

2. Call from `createInvite()` when `RESEND_API_KEY` set; log warning and still return token in API response for dev when missing.

3. Do not include JWT or secrets in email.

4. Rate limit: max 20 invites per org per day (simple count query).

5. Audit `org.member_invited` includes `email` hashed or domain only in details.

## Expected behavior

- Invite email arrives in test inbox (Resend sandbox)
- Without Resend key, invite still created; dev copies link from ops settings UI

## Test

```bash
cd core.carinaai.uk && pnpm test src/hosted/invite-email.test.ts
```

Mock Resend client; assert template contains org name and invite URL.
