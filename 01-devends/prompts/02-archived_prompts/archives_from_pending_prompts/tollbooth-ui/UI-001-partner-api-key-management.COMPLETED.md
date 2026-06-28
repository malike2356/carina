# UI-001: Partner API Key Management

**Status:** COMPLETED 2026-06-26
**Sprint:** Tollbooth UI surfaces
**Phase:** 4 - Make the tollbooth operable by partners without ops intervention
**Depends on:** TB-002 (partner_api_keys table + service), TB-003 (gateway auth)
**Target repos:** `02-backends/core.carinaai.uk` (backend additions) and `03-frontends/client-apps/app.carinaai.uk` (UI)
**Agent:** Claude Code

## What was built

**Core backend (`core.carinaai.uk`):**
- `GET/POST/DELETE /api/carina-ops/partner/api-keys` - moved OUT of `requireHostedSession` block; uses `requireOpsAuth` + `X-Core-Org-Id` header. Auth architecture: ops token authenticates the caller (the Next.js app server), `X-Core-Org-Id` carries the org UUID stored in `workspaces.coreOrgId`.
- `src/lib/core-api-proxy.ts` - added `extraHeaders` param to `proxyToCoreApi`

**Next.js app (`app.carinaai.uk`):**
- `src/app/api/developer/keys/route.ts` - GET + POST; reads `workspace.coreOrgId`, passes as `x-core-org-id` header
- `src/app/api/developer/keys/[keyId]/route.ts` - DELETE
- `src/app/(workspace)/developer/layout.tsx` - tab nav shell
- `src/app/(workspace)/developer/page.tsx` - redirect to /developer/keys
- `src/app/(workspace)/developer/keys/page.tsx` - server component with key table
- `src/app/(workspace)/developer/usage/page.tsx` - placeholder
- `src/components/developer/DeveloperTabNav.tsx` - client component for active-tab highlighting
- `src/components/developer/CreateKeyDialog.tsx` - dialog with scope toggles, rate-limit input, one-time key reveal
- `src/components/developer/RevokeKeyButton.tsx` - inline confirm before DELETE
- `src/lib/workspace-nav.ts` - `/developer`, `/developer/keys`, `/developer/usage` entries added
- `src/components/shell/AppSidebar.tsx` - `Code2` and `KeyRound` icons added

---

## Context

TB-002 built the `partner_api_keys` table and the service layer, but all CRUD routes
are behind `requireOpsAuth` (ops token). Partners cannot manage their own keys through
the workspace UI. This prompt adds session-authenticated self-service routes and the
frontend pages so a partner can create, list, and revoke their gateway API keys without
filing a support request.

Partners access `app.carinaai.uk` as a workspace. The workspace is owned by an org that
has a `partner_id` foreign key pointing to a `partner_accounts` row. The UI must verify
this relationship on every call.

---

## Task

### 1. Backend: session-authenticated partner key routes

In `02-backends/core.carinaai.uk/src/api/carina-ops-routes.ts`, add the following
routes in the section AFTER `router.use(requireHostedSession)` (after line ~326 where
`requireOpsPlan('carina_ops_starter')` is called). These routes use the existing
`requireHostedSession` and verify partner ownership via `getPartnerOwnedByOrg`.

Import at the top of the file (alongside existing imports):
```typescript
import {
  createPartnerApiKey,
  listPartnerApiKeys,
  revokePartnerApiKey,
  type PartnerApiKeyScope,
} from '../hosted/partner-api-key-service.js';
```

Add these three routes inside `mountCarinaOpsRoutes`, after the `requireOpsPlan` line:

```
GET  /partner/api-keys          list keys for the partner owned by the logged-in org
POST /partner/api-keys          create a key; returns rawKey once in response
DELETE /partner/api-keys/:keyId revoke a key owned by this partner
```

Logic for each:
- Resolve `orgId` from `orgContext(req).orgId`
- Call `getPartnerOwnedByOrg(orgId)` to get the partner; return 403 if null
- Call the relevant function from `partner-api-key-service.ts`
- Create route: validate body fields `label` (required, string), `scopes` (array of valid
  scope strings, default `['session']`), `rateLimitRpm` (number 1-600, default 60),
  `monthlyCapEvents` (number, default 100000). Return 400 on validation failure.
- Create route: return `{ key: result }` where result includes `rawKey` (only time it
  is returned). Log a `platform_event` with `event_type: 'api_key_created'` using
  `emitPlatformEvent` (fire-and-forget, never throws).
- Delete route: return 404 if key not found or not owned by this partner.

### 2. Frontend: new developer section in app.carinaai.uk

**File structure to create:**

```
src/app/(workspace)/developer/
  layout.tsx          sub-nav layout with two tabs: "API Keys" and "Usage"
  keys/
    page.tsx          server component, loads key list
  usage/
    page.tsx          placeholder only for now - "See UI-002 prompt"
```

**`src/app/(workspace)/developer/layout.tsx`:**

Sub-nav with two `<Link>` tabs styled to match the existing settings sub-nav pattern.
Tabs: `API Keys` linking to `/developer/keys`, `Usage` linking to `/developer/usage`.
Add `export const dynamic = 'force-dynamic'`.

**`src/app/(workspace)/developer/keys/page.tsx`:**

Server component. Fetch from `/partner/api-keys` via the core URL (use
`resolveCoreSurfaceUrl` from `@/lib/core-surface`) with the session cookie forwarded
(use `headers()` from `next/headers` to pass `cookie`). If the fetch returns 403 (not
a partner account), render an empty-state message: "This workspace does not have a
partner account. Contact support to apply." Do not redirect.

If fetch succeeds, render:
- `<PageHeader title="API Keys" description="Keys your customers use to call the Carina gateway." actions={<CreateKeyButton />} />`
- A table (or card list) of existing keys:
  - Columns: Label, Prefix (first 16 chars), Scopes, Rate limit, Status, Last used, Revoke button
  - If no keys: empty state "No API keys yet. Create one to get started."

**`src/components/developer/CreateKeyDialog.tsx`** (client component):

Dialog triggered by the "Create key" button in PageHeader actions.
Form fields:
- Label (text input, required)
- Scopes (checkbox group: session, memory, skills, analytics - NOT admin)
- Rate limit RPM (number input, default 60, min 1, max 600)

On submit: POST to `/api/developer/keys` (Next.js API route below).
On success: show a one-time key reveal modal with the raw `cpk_` key in a monospace
box and a copy-to-clipboard button. Warn clearly: "This key will not be shown again."
Dismiss closes the modal and refreshes the key list via `router.refresh()`.

**`src/components/developer/RevokeKeyButton.tsx`** (client component):

A "Revoke" button with a confirm step (inline confirmation, not a modal).
On confirm: DELETE to `/api/developer/keys/[keyId]` (Next.js API route below).
On success: `router.refresh()`.

**Next.js API routes:**

```
src/app/api/developer/keys/route.ts        GET (list), POST (create)
src/app/api/developer/keys/[keyId]/route.ts  DELETE (revoke)
```

Each route:
1. Gets the current session via `requireSession()` (throw/redirect if unauthenticated)
2. Calls the core server at `CARINA_CORE_URL/partner/api-keys` (or `/partner/api-keys/:keyId`)
   by forwarding the session cookie
3. Returns the response body as-is with the same status code

Use `process.env.CARINA_CORE_URL ?? 'http://localhost:3000'` as the base.

**Add nav entry:**

In `src/components/shell/AppSidebar.tsx`, find the nav items array and add:
```
{ href: '/developer', label: 'Developer', icon: <KeyRound size={16} /> }
```
Place it after the `settings` entry. Import `KeyRound` from `lucide-react`.

---

## What NOT to do

- Do not show `key_hash` anywhere in the UI.
- Do not allow creation of keys with `admin` scope from the UI.
- Do not automate key rotation - revoke and recreate is the workflow.
- Do not fetch from the core backend directly in client components - always go through
  the Next.js API route so the core URL and session handling stay server-side.

---

## Done when

- [ ] `GET /partner/api-keys` returns keys for the partner owned by logged-in org
- [ ] `POST /partner/api-keys` returns rawKey in the response (once only)
- [ ] `DELETE /partner/api-keys/:keyId` revokes and returns 204
- [ ] `/developer/keys` page lists keys with prefix, scopes, rate limit, last used, revoke
- [ ] Create key dialog collects label + scopes + RPM, shows raw key once on success
- [ ] Revoke button has inline confirm step
- [ ] 403 (not a partner) renders a clear "not a partner account" message, no crash
- [ ] Developer nav entry appears in the workspace sidebar
- [ ] `pnpm build` compiles in both repos without TypeScript errors
