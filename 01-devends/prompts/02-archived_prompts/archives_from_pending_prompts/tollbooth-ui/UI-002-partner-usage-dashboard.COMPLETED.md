# UI-002: Partner Usage Dashboard

**Sprint:** Tollbooth UI surfaces
**Phase:** 4 - Make the tollbooth operable by partners without ops intervention
**Depends on:** TB-005 (analytics API), UI-001 (developer section + nav)
**Target repos:** `02-backends/core.carinaai.uk` (one backend route) and `03-frontends/client-apps/app.carinaai.uk` (UI)
**Agent:** Claude Code

---

## Context

TB-005 built analytics endpoints (`/api/v1/platform/usage`, `/api/v1/platform/trends`)
on the gateway, but those endpoints require a `cpk_` API key for auth. Partners viewing
their own usage in the workspace need a session-authenticated route instead. This prompt
adds that route and builds the dashboard page in the `developer/` section created by
UI-001.

The dashboard shows:
- A headline stat row: total events this month, tokens in, tokens out, estimated fee
- A daily event volume line chart (last 30 days)
- A grouped breakdown table (by model or event type, user-selectable)
- A CSV export button (calls the existing `/api/v1/platform/export` endpoint adapted
  for session auth)

---

## Task

### 1. Backend: session-authenticated usage route

In `02-backends/core.carinaai.uk/src/api/carina-ops-routes.ts`, inside
`mountCarinaOpsRoutes` in the section after `requireHostedSession` and
`requireOpsPlan('carina_ops_starter')`, add:

```
GET /partner/usage
```

Query parameters:
- `from` (ISO date, required)
- `to` (ISO date, required)
- `groupBy` (optional: `day` | `model` | `event_type`, default `day`)
- `orgId` (optional UUID: filter to a specific client org; validate it belongs to this partner)

Logic:
1. Resolve partner via `getPartnerOwnedByOrg(orgContext(req).orgId)`. Return 403 if null.
2. Validate `from` and `to`. Max range 90 days, return 400 if exceeded.
3. If `orgId` provided, verify it via
   `SELECT id FROM organizations WHERE id=$1 AND partner_id=$2`. Return 403 if not found.
4. Branch on `groupBy` exactly as in `gateway-routes.ts` (`GET /api/v1/platform/usage`)
   but substitute the `partner_id = $N` bind parameter for the resolved `partner.id`
   instead of resolving from a Bearer key.
5. Compute totals and `estimatedFeePence` using identical logic to `gateway-routes.ts`.
6. Return identical response shape so the frontend can use the same types.

Also add:

```
GET /partner/usage/export
```

Same logic as `GET /api/v1/platform/export` in `gateway-routes.ts` but session-auth.
Max 31 days. Accepts `format=csv` (default) or `format=ndjson`. Sets
`Content-Disposition: attachment` header. Emits a platform event audit entry
(fire-and-forget) with `event_type: 'compliance_export'`.

### 2. Frontend: usage dashboard page

Replace the placeholder `/developer/usage/page.tsx` created by UI-001.

**`src/app/(workspace)/developer/usage/page.tsx`** (server component):

Fetch initial data for the current calendar month (`from` = first day of month,
`to` = today) with `groupBy=day` from `/partner/usage` via the core URL (cookie-forwarded,
same pattern as UI-001). Render `<UsageDashboard initialData={data} />`.

If fetch returns 403, render the same "not a partner account" empty state as UI-001.

**`src/components/developer/UsageDashboard.tsx`** (client component):

Props: `initialData` (the response from `/partner/usage`, or null for loading state).

State:
- `dateRange`: `{ from: string; to: string }` (ISO dates), initialized to current month
- `groupBy`: `'day' | 'model' | 'event_type'`, default `'day'`
- `data`: fetched response, starts from `initialData`
- `loading`: boolean

On mount and when `dateRange` or `groupBy` changes: fetch `/api/developer/usage` (Next.js
API route) with the current params.

Layout:
```
[Date range picker: two <input type="date"> fields]   [Group by: <select>]   [Export CSV button]

[Stat cards row]
  Total events | Tokens in | Tokens out | Est. fee (GBP)

[Line chart: daily event volume - only shown when groupBy=day]
  x-axis: date labels (formatted as "Jun 1")
  y-axis: event count
  Use recharts LineChart + ResponsiveContainer (already in the admin package;
  add recharts to app.carinaai.uk if not already a dependency)

[Breakdown table]
  groupBy=day:        Date | Events | Tokens in | Tokens out
  groupBy=model:      Model | Events | Tokens in | Tokens out
  groupBy=event_type: Event type | Events | Tokens in | Tokens out
```

The "Export CSV" button makes a GET request to `/api/developer/usage/export?from=...&to=...&format=csv`
and triggers a browser download by creating a temporary `<a>` with `download` attribute
pointed at a blob URL.

**Next.js API routes:**

```
src/app/api/developer/usage/route.ts           GET - proxy to /partner/usage
src/app/api/developer/usage/export/route.ts    GET - proxy to /partner/usage/export
                                               (stream response as-is, preserve Content-Disposition)
```

Each route: requireSession, forward cookie to core server, return response.
The export route must forward the `Content-Disposition` header so the browser triggers
a download.

**Stat card component:**

```
src/components/developer/StatCard.tsx
```

Props: `label: string`, `value: string | number`, `sub?: string`.
Plain div: label in small text, value in large semibold, sub in muted small. No icon.
Use the same visual language as the admin revenue page stat cards.

---

## What NOT to do

- Do not use the `cpk_` gateway auth path for these routes. Session auth only.
- Do not show individual request bodies or user data - only aggregated event counts.
- Do not build a real-time streaming view. A fetch-on-change pattern is sufficient.
- Do not add a third-party charting library if recharts is already in the monorepo.
  Check `package.json` in `app.carinaai.uk` before adding.

---

## Done when

- [ ] `GET /partner/usage` returns groupBy=day series for the logged-in partner
- [ ] `GET /partner/usage/export` returns CSV with Content-Disposition attachment
- [ ] `/developer/usage` page renders stat cards and a line chart for current month
- [ ] Changing groupBy re-fetches and re-renders the breakdown table
- [ ] Date range inputs update the chart and table on change
- [ ] Export CSV button triggers a browser file download
- [ ] 403 renders "not a partner account" empty state, no crash
- [ ] `pnpm build` compiles in both repos without TypeScript errors
