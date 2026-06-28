# UI-004: Partner Accounts Admin

**Sprint:** Tollbooth UI surfaces
**Phase:** 4 - Make the tollbooth operable by partners without ops intervention
**Depends on:** TB-001, TB-002, TB-004, TB-007 (all backend data exists)
**Target repos:** `02-backends/core.carinaai.uk` (several list/detail routes) and `03-frontends/client-apps/admin.carinaai.uk` (UI)
**Agent:** Claude Code

---

## Context

The VERLOX ops team needs visibility into all partner accounts: who is active, how many
events they have generated this month, which API keys they hold, and whether any SLA credit
is owed. This is the ops command centre for the tollbooth.

Currently the admin panel (`admin.carinaai.uk`) has no partner section. The data lives
in `partner_accounts`, `partner_api_keys`, `platform_events`, and `sla_credits` tables
in the core DB, all reachable via existing or new ops routes.

---

## Task

### 1. Backend: partner list and detail ops routes

In `02-backends/core.carinaai.uk/src/api/carina-ops-routes.ts`, add the following
before the `requireHostedSession` section (they use `requireOpsAuth` inline):

**Partner list:**

```
GET /internal/partners
```

Query params: `status` (active | suspended | archived, default all), `search` (text
match on name or slug), `page` (default 1), `limit` (default 25).

Returns each partner row joined with:
- `key_count`: number of active API keys
- `events_this_month`: count of `platform_events` WHERE `partner_id = p.id`
  AND `created_at >= date_trunc('month', NOW())`
- `client_org_count`: count of organizations WHERE `partner_id = p.id`

Response: `{ partners: [...], total, page, limit }`.

**Partner detail:**

```
GET /internal/partners/:partnerId/detail
```

Returns:
```json
{
  "partner": { id, name, slug, status, commercialTier, stripeCustomerId,
               stripeSubscriptionId, createdAt, updatedAt },
  "apiKeys": [ ...from listPartnerApiKeys(partnerId) ],
  "clientOrgs": [ { id, name, slug, plan, status, createdAt } ],
  "usageThisMonth": { events, tokensIn, tokensOut, toolCalls, skillCalls, estimatedFeePence },
  "slaCredits": [ ...from SELECT * FROM sla_credits WHERE partner_id = $1 ORDER BY created_at DESC LIMIT 12 ]
}
```

For `usageThisMonth`, query:
```sql
SELECT COUNT(*) AS events,
       COALESCE(SUM(tokens_in), 0) AS tokens_in,
       COALESCE(SUM(tokens_out), 0) AS tokens_out,
       COALESCE(SUM(tool_calls), 0) AS tool_calls,
       COALESCE(SUM(skill_calls), 0) AS skill_calls
FROM platform_events
WHERE partner_id = $1
  AND created_at >= date_trunc('month', NOW())
```

**Partner status change:**

```
PATCH /internal/partners/:partnerId/status
```

Body: `{ status: 'active' | 'suspended' | 'archived' }`.
Updates `partner_accounts SET status = $1 WHERE id = $2`. Returns updated partner row.
Emit `platform_event` with `event_type: 'partner_status_changed'` and
`metadata: { newStatus }` (fire-and-forget).

**Partner API key revoke (admin override):**

```
DELETE /internal/partners/:partnerId/keys/:keyId
```

This already exists from TB-002 but is currently ops-auth. Confirm it is already
registered. If not, add it here.

### 2. Frontend: Partners section in admin.carinaai.uk

**Nav registration:**

In `src/lib/admin-nav.ts`, add:
```typescript
import { Building2 } from 'lucide-react';
// in ADMIN_NAV_ITEMS array:
{ href: '/partners', label: 'Partners', Icon: Building2 },
```

Place after Customers, before Fleet.

**File structure:**

```
src/app/(admin)/partners/
  page.tsx          partner list (client component)
  [id]/
    page.tsx        partner detail (client component)
```

**`src/app/(admin)/partners/page.tsx`:**

Client component. State: `search`, `statusFilter`, `page`, `loading`, `partners`, `total`.

Fetch from `/api/admin/partners?status=active&page=1&limit=25` on mount and on filter change.
Debounce the search input by 300ms (use existing `useDebouncedValue` hook from
`@/lib/use-debounced-value`).

Layout:
```
[Page header: "Partners"]
[Search input]   [Status filter: All | Active | Suspended | Archived]

[Table]
  Name | Slug | Tier | Keys | Client orgs | Events this month | Status | Actions
  - Status cell: green badge for active, amber for suspended, grey for archived
  - Events this month: formatted number
  - Actions: "View" link -> /partners/[id]
[Pagination: Prev / Next]
```

**`src/app/(admin)/partners/[id]/page.tsx`:**

Client component. Fetch `/api/admin/partners/[id]` on mount.

Layout:
```
[Back: <- Partners]
[Partner name as heading] [Status badge] [Tier badge]

[Stat row]
  Events this month | Est. fee (pence -> GBP) | Client orgs | Active keys

[Tabs: Overview | API Keys | Client Orgs | SLA Credits]

Tab: Overview
  Detail grid: id, slug, stripe customer ID, subscription ID, created, updated
  [Suspend button] (if status=active) or [Reactivate button] (if status=suspended)
  Button calls PATCH /api/admin/partners/[id]/status. Confirm step inline.
  On success: re-fetch and re-render. Show toast.

Tab: API Keys
  Table: label, prefix, scopes, rate limit, status, last used, [Revoke button]
  Revoke calls DELETE /api/admin/partners/[id]/keys/[keyId].
  Confirm step inline. On success: re-fetch.

Tab: Client Orgs
  Table: org name, slug, plan, status, created
  No actions from this view.

Tab: SLA Credits
  Table: billing month, downtime minutes, credit pence (formatted as GBP), stripe credit ID
         (if applied), applied at
  If empty: "No SLA credits issued for this partner."
```

**Next.js API routes:**

```
src/app/api/admin/partners/route.ts                    GET (list)
src/app/api/admin/partners/[id]/route.ts               GET (detail)
src/app/api/admin/partners/[id]/status/route.ts        PATCH (status change)
src/app/api/admin/partners/[id]/keys/[keyId]/route.ts  DELETE (revoke key)
```

Each: `requireAdminSession`, then `proxyAdminRequest` forwarding to the corresponding
`/internal/partners/...` path on the core server.

**Shared utility:**

Add `formatGbp(pence: number): string` to `src/lib/format.ts` if it does not already
exist. Returns `"GBP 0.00"` format: `(pence / 100).toFixed(2)`.

---

## What NOT to do

- Do not expose raw Stripe customer or subscription IDs in any publicly visible UI.
  This view is admin-only and should remain behind admin auth.
- Do not implement SLA credit application from the UI. The SLA credits table is
  read-only from the admin view. Credit application is done manually via Stripe dashboard
  until three months of clean manual runs confirm the formula is correct (per TB-007 spec).
- Do not add partner creation from the admin UI in this prompt. Partners are provisioned
  via the existing ops route (`POST /internal/partners`) until there is enough volume to
  justify a full onboarding wizard.
- Do not paginate API keys or client orgs within the detail view. A partner with hundreds
  of keys or orgs is not the current scale target; add pagination later when needed.

---

## Done when

- [ ] `GET /internal/partners` returns list with key_count, events_this_month, client_org_count
- [ ] `GET /internal/partners/:id/detail` returns full partner snapshot
- [ ] `PATCH /internal/partners/:id/status` updates status and emits platform event
- [ ] Partner list page renders with search, status filter, and pagination
- [ ] Partner detail page renders all four tabs with correct data
- [ ] Suspend/Reactivate action updates badge and re-renders without full page reload
- [ ] API key revoke works from the detail view
- [ ] Partners nav item appears in admin sidebar between Customers and Fleet
- [ ] `pnpm build` compiles in both repos without TypeScript errors
