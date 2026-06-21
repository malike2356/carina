# Carina Ops Sprint 6.5: Support impersonation (ops back office only)

## Goal

Allow VERLOX support to start a read-only impersonation session for troubleshooting, fully audited.

## Context

- **Internal only:** `ops.carinaai.uk`
- Never expose impersonation to customer Carina Ops UI
- Read-only v1: view usage, audit, vault summaries; no write actions

## Dependencies

- `11-ops-support-tenant-scoping.md`

## Files to modify

- `ops.carinaai.uk/routes/tenants.ts`
- `ops.carinaai.uk/lib/tenant-audit.ts`
- `ops.carinaai.uk/views/tenant-detail.ejs`

## Files to create

- `ops.carinaai.uk/lib/support-impersonation.ts`
- `ops.carinaai.uk/lib/support-impersonation.test.ts`

## Step-by-step

1. `POST /tenants/:id/impersonate` (ops admin only):

- Creates short-lived token (15 min) stored in server session as `impersonation: { tenantId, orgId, startedAt, actor: 'ops-admin' }`
- Writes `tenant.impersonate_start` to `ops_audit_log`

2. `POST /tenants/impersonation/end` clears session.

3. While impersonating, ops UI shows red banner:

```text
IMPERSONATION MODE: read-only view for tenant X. End session.
```

4. Impersonation does not grant customer JWT; ops views tenant data through existing tenant detail queries with extra audit on each page view.

5. Block impersonation write routes at middleware level.

6. Optional: link "Open customer view" opens `app.carinaai.uk` in new tab without auto-login (no password handoff in v1).

## Expected behavior

- Start impersonation creates audit row
- End impersonation creates `tenant.impersonate_end`
- No customer API accepts ops impersonation token

## Test

```bash
cd ops.carinaai.uk && pnpm test lib/support-impersonation.test.ts
```

## Pitfalls

- Do not log decrypted BYOK keys during impersonation
- Do not store impersonation token in URL query string
