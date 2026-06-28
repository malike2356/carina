# UI-003: Marketplace Submission Review Queue

**Sprint:** Tollbooth UI surfaces
**Phase:** 4 - Make the tollbooth operable by partners without ops intervention
**Depends on:** TB-006 (pack_submissions table + hub routes)
**Target repos:** `02-backends/core.carinaai.uk` (one proxy route) and `03-frontends/client-apps/admin.carinaai.uk` (UI)
**Agent:** Claude Code

---

## Context

TB-006 built the submission workflow: `POST /api/submissions`, `GET /api/submissions/:id`,
`PATCH /api/submissions/:id` (approve/reject), `POST /api/submissions/:id/publish`. These
routes live on the hub server (`carina-hub`, port 3001). The admin panel calls the core
server (`carina-web`, port 3000) via `coreAdminFetch`. Rather than adding a second base URL
to the admin panel, add lightweight proxy routes to the core server that forward to the hub
server, then build the review UI in `admin.carinaai.uk`.

The review queue is for VERLOX internal use only: one person reads each submission and
clicks approve or reject. The UI is intentionally minimal.

---

## Task

### 1. Backend: core-to-hub proxy routes

In `02-backends/core.carinaai.uk/src/api/carina-ops-routes.ts`, add four routes
BEFORE the `requireHostedSession` section (they use `requireOpsAuth` inline, same
pattern as the other ops routes in that section):

```
GET  /internal/marketplace/submissions          list submissions (query: status, page, limit)
GET  /internal/marketplace/submissions/:id      get single submission
PATCH /internal/marketplace/submissions/:id     approve or reject (body: action, reviewerNotes)
POST  /internal/marketplace/submissions/:id/publish  publish approved submission
```

Each route implementation:
1. Call `requireOpsAuth` inline (same three-line pattern used in billing routes).
2. Forward the request to the hub server at `config.hub.baseUrl ?? 'http://carina-hub:3001'`.
   Use `fetch` with method, query string, and body forwarded as-is.
   Add header `Authorization: Bearer ${config.hub.publishApiKey}` (reuse hub auth).
3. Stream the response body back with the same status code.
4. On fetch error: return `{ error: 'hub_unreachable' }` with status 502.

For the list route, the hub currently has no list endpoint. Add it:

In `02-backends/core.carinaai.uk/src/skills/hub/server.ts`, add before the error handler:

```
GET /api/submissions   (ops-auth, same authorizeOps check)
```

Query parameters: `status` (pending | approved | rejected | published, default pending),
`page` (number, default 1), `limit` (number, default 20).

Query:
```sql
SELECT * FROM pack_submissions
WHERE ($1::text IS NULL OR status = $1)
ORDER BY submitted_at DESC
LIMIT $2 OFFSET $3
```

Also `SELECT COUNT(*) FROM pack_submissions WHERE ($1::text IS NULL OR status = $1)` for
pagination.

Return: `{ submissions: [...], total, page, limit }`.

### 2. Backend: hub config

In `02-backends/core.carinaai.uk/src/config/index.ts`, confirm (or add if missing):

```typescript
hub: {
  baseUrl: process.env.HUB_BASE_URL ?? 'http://carina-hub:3001',
  publishApiKey: process.env.HUB_PUBLISH_API_KEY ?? '',
}
```

Add `HUB_BASE_URL=http://carina-hub:3001` to `.env.production.example` with a comment.

### 3. Frontend: Marketplace section in admin.carinaai.uk

**Nav registration:**

In `src/lib/admin-nav.ts`, add:
```typescript
import { PackageCheck } from 'lucide-react';
// in ADMIN_NAV_ITEMS array:
{ href: '/marketplace', label: 'Marketplace', Icon: PackageCheck },
```

Place it after Revenue and before Audit Log.

**File structure:**

```
src/app/(admin)/marketplace/
  page.tsx             submission list (client component, default status=pending)
  [id]/
    page.tsx           submission detail + review actions (client component)
```

**`src/app/(admin)/marketplace/page.tsx`:**

Client component. State: `status` filter (tabs: Pending | Approved | Rejected | Published),
`page`, `loading`, `submissions`, `total`.

Fetch from `/api/admin/marketplace/submissions?status=pending&page=1&limit=20` on mount
and when tab or page changes.

Layout:
```
[Page header: "Marketplace Submissions"]
[Tab bar: Pending (badge count) | Approved | Rejected | Published]
[Table]
  Pack name | Version | Author | Submitted | Pricing | Actions
  Each row links to /marketplace/[id]
[Pagination: simple Prev / Next if total > limit]
```

The Pending tab should show a badge with the count of pending submissions (from `total`
when status=pending). Re-read on tab change.

**`src/app/(admin)/marketplace/[id]/page.tsx`:**

Client component. Fetch submission detail from `/api/admin/marketplace/submissions/[id]`
on mount.

Layout:
```
[Back link: <- Submissions]
[Pack name + version as heading]
[Two-column detail grid]
  Left: author handle, author email, description, category, pricing tier, price,
        archive URL (linked), submitted at, reviewed at, published at
  Right: status badge, reviewer notes (if any)

[Review panel - only shown when status = 'pending']
  Textarea: "Reviewer notes (optional)"
  [Approve button] [Reject button]
  Approve calls PATCH with { action: 'approve', reviewerNotes }
  Reject calls PATCH with { action: 'reject', reviewerNotes } (requires notes if rejecting)

[Publish panel - only shown when status = 'approved']
  "This submission has been approved. Publish it to make it live in the marketplace."
  [Publish button]
  Calls POST /api/admin/marketplace/submissions/[id]/publish
```

After any action: re-fetch the submission to refresh the status display. Show a toast on
success using the existing `useToast` hook.

**Next.js API routes (proxy to core ops routes):**

```
src/app/api/admin/marketplace/submissions/route.ts           GET (list)
src/app/api/admin/marketplace/submissions/[id]/route.ts      GET (detail), PATCH (review)
src/app/api/admin/marketplace/submissions/[id]/publish/route.ts  POST (publish)
```

Each route: use `proxyAdminRequest` from `@/lib/proxy-admin` forwarding to the
corresponding `/internal/marketplace/submissions` path on the core server.
Use `requireAdminSession` to protect each route.

---

## What NOT to do

- Do not auto-publish on approval. Approval and publication are two separate actions.
  A reviewer may approve in bulk and publish individually.
- Do not show the archive URL to end users anywhere in the public marketplace.
  The admin view is internal only.
- Do not add email actions from the admin UI. Emails are already sent automatically
  by the hub server when `reviewSubmission` and `publishSubmission` are called.
- Do not paginate more than 20 rows per page. The queue should not grow large if
  reviewed regularly.

---

## Done when

- [ ] `GET /internal/marketplace/submissions` proxies to hub and returns list
- [ ] `GET /api/submissions` on hub server returns paginated list with `total`
- [ ] Pending/Approved/Rejected/Published tabs load correctly
- [ ] Submission detail page shows all fields
- [ ] Approve action updates status and re-renders the detail page
- [ ] Reject action requires notes; updates status and re-renders
- [ ] Publish action appears only for approved submissions; triggers publication
- [ ] Toast confirms each action
- [ ] Marketplace nav item appears in admin sidebar
- [ ] `pnpm build` compiles in both repos without TypeScript errors
