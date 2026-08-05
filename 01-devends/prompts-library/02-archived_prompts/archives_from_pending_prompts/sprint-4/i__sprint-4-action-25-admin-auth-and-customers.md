# Sprint 4 - Prompt 25: Admin App Scaffold, Auth, and Customer Management

**Status: COMPLETED 2026-06-23**

**What was built:** `admin.carinaai.uk` scaffold (auth, shell, VA queue badge), customers list with filters, customer detail with override panel, audit log with filters and CSV export; core `admin-workspace-queries.ts`, `admin-audit-queries.ts`, workspace override routes.

**Sprint:** 4
**Prompt number:** 25
**Primary agent:** Claude Code (backend) + Cursor (frontend)
**Estimated hours:** 10-14 h
**Depends on:** 22-billing-backend.md must be merged (billing data is the source for customer detail)

---

## Post-build (MANDATORY)

When all "Done When" criteria are satisfied:
1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Move to `01-devends/prompts/02-archived_prompts/archives_from_pending_prompts/sprint-4/action/`.

---

## Read First

Read every file listed before writing a single line of code:

1. `03-frontends/client-apps/app.carinaai.uk/package.json` - match Next.js, Tailwind, iron-session, lucide-react versions exactly
2. `03-frontends/client-apps/app.carinaai.uk/tailwind.config.ts` - design tokens to copy into admin app
3. `03-frontends/client-apps/app.carinaai.uk/src/middleware.ts` - auth middleware pattern to replicate
4. `03-frontends/client-apps/app.carinaai.uk/src/lib/session.ts` - session utilities pattern; do not import from workspace app
5. `02-backends/core.carinaai.uk/src/aiva/aiva-api.ts` - existing Aiva routes; admin routes extend this file
6. `02-backends/core.carinaai.uk/src/billing/aiva-billing.ts` - billing functions called by override routes
7. `02-backends/core.carinaai.uk/src/billing/stripe-service.ts` - Stripe client for credit actions
8. `02-backends/core.carinaai.uk/src/db/` - DB client and migration pattern

---

## Context

`admin.carinaai.uk` is a standalone Next.js application used exclusively by the VERLOX internal team.
It is NOT the workspace portal (`app.carinaai.uk`). It shares the same dark base design language but
uses amber as its primary accent instead of teal, and carries a persistent amber topbar strip so it is
impossible to confuse with the customer-facing app. No customer can access any route in this app.

This prompt builds: the app scaffold, admin-specific design system, authentication, the shell layout
(sidebar + topbar), the customers list page, the customer detail page with override panel, and the
audit log page. Prompts 26 and 27 add Fleet, VA Queue, and Revenue pages to the same shell.

---

## Step 1: Database migration - 009-aiva-admin.sql

Create `02-backends/core.carinaai.uk/src/db/migrations/009-aiva-admin.sql`:

```sql
-- Admin flag on existing users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Admin action audit trail
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID        NOT NULL REFERENCES users(id),
  action        TEXT        NOT NULL,
  target_type   TEXT        NOT NULL,  -- 'workspace' | 'aiva' | 'escalation' | 'invoice'
  target_id     TEXT        NOT NULL,
  metadata      JSONB       NOT NULL DEFAULT '{}',
  ip_address    INET,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON admin_audit_log(admin_user_id, created_at DESC);
CREATE INDEX ON admin_audit_log(target_type, target_id, created_at DESC);

-- VA team members (used by prompt 27; defined here as the shared foundation)
CREATE TABLE IF NOT EXISTS va_team_members (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  email        TEXT        NOT NULL UNIQUE,
  available    BOOLEAN     NOT NULL DEFAULT true,
  current_load INTEGER     NOT NULL DEFAULT 0,
  max_load     INTEGER     NOT NULL DEFAULT 5,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Aiva escalations (structured lifecycle record for each escalation event)
-- The ai_worker_activity row with action_type='escalated' is the raw event;
-- this table is the managed work item for the VA team.
CREATE TABLE IF NOT EXISTS aiva_escalations (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id                 UUID        NOT NULL REFERENCES ai_workers(id),
  workspace_id              UUID        NOT NULL,
  activity_id               UUID        REFERENCES ai_worker_activity(id),
  status                    TEXT        NOT NULL DEFAULT 'unassigned',
  reason                    TEXT        NOT NULL,
  conversation_context      JSONB       NOT NULL DEFAULT '[]',
  assigned_to               UUID        REFERENCES va_team_members(id),
  assigned_at               TIMESTAMPTZ,
  first_response_at         TIMESTAMPTZ,
  resolved_at               TIMESTAMPTZ,
  resolution_note           TEXT,
  priority                  TEXT        NOT NULL DEFAULT 'normal',
  sla_first_response_target TIMESTAMPTZ,
  sla_resolution_target     TIMESTAMPTZ,
  sla_breach                BOOLEAN     NOT NULL DEFAULT false,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON aiva_escalations(status, created_at DESC);
CREATE INDEX ON aiva_escalations(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX ON aiva_escalations(workspace_id, created_at DESC);
CREATE INDEX ON aiva_escalations(worker_id, created_at DESC);

-- Admin notes on workspaces
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Monthly amount cache on subscriptions for MRR calculation
ALTER TABLE aiva_subscriptions
  ADD COLUMN IF NOT EXISTS monthly_amount_pence INTEGER NOT NULL DEFAULT 0;

UPDATE aiva_subscriptions SET monthly_amount_pence = CASE plan_tier
  WHEN 'starter'  THEN 4900
  WHEN 'team'     THEN 19900
  WHEN 'business' THEN 49900
  ELSE 0
END;

-- Payment intent link on invoices for refund support
ALTER TABLE aiva_invoices
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
```

Run this migration via the existing migration runner before building any backend routes.

---

## Step 2: Admin app scaffold

Create a new Next.js app at `03-frontends/client-apps/admin.carinaai.uk/`.

```bash
npx create-next-app@[same version as app.carinaai.uk] admin.carinaai.uk \
  --typescript --tailwind --app --no-src-dir --import-alias "@/*"
```

Then:
- Move all source files into `src/` to match workspace app structure
- Copy `tailwind.config.ts` from the workspace app; the design tokens (`bg-base`, `bg-elevated`, etc.) must be identical
- Copy `tsconfig.json` from workspace app; adjust paths for admin app
- Add to `package.json`: same `iron-session`, `zod`, `lucide-react` versions as workspace app

**Admin-specific design additions in `src/app/globals.css`:**

Add these utility classes. They extend the shared token system with amber-primary variants:

```css
.btn-admin-primary {
  @apply bg-amber-500 text-black font-medium text-sm px-4 py-2 rounded-md
         hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:pointer-events-none;
}

.btn-admin-danger {
  @apply border border-red-500/40 text-red-400 text-xs rounded-md px-3 py-1.5
         hover:bg-red-500/10 transition-colors;
}

.btn-admin-credit {
  @apply bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs rounded-md px-3 py-1.5
         hover:bg-amber-500/25 transition-colors;
}

.admin-section-divider {
  @apply border-t border-border my-3;
}
```

**`.env.example`:**
```env
ADMIN_CORE_URL=https://core.carinaai.uk
ADMIN_SESSION_SECRET=        # 32+ char secret, separate from workspace app secret
ADMIN_TOKEN_SECRET=          # used to sign X-Admin-Token JWTs sent to core
ADMIN_SETUP_TOKEN=           # static pre-shared secret for the /auth/check bootstrap route
NEXT_PUBLIC_APP_URL=https://admin.carinaai.uk
NEXT_PUBLIC_STRIPE_DASHBOARD_URL=https://dashboard.stripe.com/customers
```

---

## Step 3: Admin shell layout

### Route structure

```
src/app/
  (auth)/
    login/page.tsx
  (admin)/
    layout.tsx              Admin shell (sidebar + topbar); requires admin session
    page.tsx                Redirect to /customers
    customers/
      page.tsx
      [id]/page.tsx
    fleet/page.tsx          (prompt 26)
    fleet/attestation/page.tsx  (prompt 26)
    va-queue/page.tsx       (prompt 27)
    revenue/page.tsx        (prompt 27)
    audit-log/page.tsx
  api/
    auth/
      login/route.ts
      logout/route.ts
    admin/
      ...all proxy routes
```

### `src/app/(admin)/layout.tsx`

The shell is a fixed topbar + fixed sidebar + scrollable content area.

```
┌────────────────────────────────────────────────────────────────┐
│ VERLOX  ADMIN                              admin@... Sign out   │  <- amber topbar h-10
├──────────────┬─────────────────────────────────────────────────┤
│  w-52        │  flex-1 overflow-y-auto px-8 py-6               │
│  sidebar     │  page content                                    │
│              │                                                  │
│  nav items   │                                                  │
│              │                                                  │
│  ──────────  │                                                  │
│  admin@...   │                                                  │
│  Sign out    │                                                  │
└──────────────┴─────────────────────────────────────────────────┘
```

**Topbar:**
```tsx
<header className="fixed top-0 left-0 right-0 z-50 h-10 flex items-center justify-between
                   px-4 bg-amber-500/15 border-b border-amber-500/30">
  <div className="flex items-center gap-2">
    <span className="text-xs font-semibold tracking-widest text-text-primary">VERLOX</span>
    <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded
                     uppercase tracking-wider">
      Admin
    </span>
  </div>
  <div className="flex items-center gap-3">
    <span className="text-xs text-text-muted">{session.email}</span>
    <form action="/api/auth/logout" method="POST">
      <button type="submit" className="text-xs text-text-muted hover:text-text-primary">
        Sign out
      </button>
    </form>
  </div>
</header>
```

**Sidebar:**
```tsx
<aside className="fixed top-10 left-0 bottom-0 w-52 bg-elevated border-r border-border
                  flex flex-col py-4 z-40">
  <nav className="flex-1 px-2 space-y-0.5">
    {NAV_ITEMS.map((item) => (
      <AdminNavItem key={item.href} item={item} />
    ))}
  </nav>
  <div className="px-4 py-3 border-t border-border">
    <p className="text-[11px] text-text-muted truncate">{session.email}</p>
  </div>
</aside>
```

`AdminNavItem` applies active state when `pathname.startsWith(item.href)`:
```tsx
<Link
  href={item.href}
  className={cn(
    'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
    isActive
      ? 'bg-amber-500/10 text-amber-400 border-l-2 border-amber-400'
      : 'text-text-secondary hover:text-text-primary hover:bg-overlay border-l-2 border-transparent',
  )}
>
  <item.Icon className="h-4 w-4 shrink-0" />
  <span>{item.label}</span>
  {item.badge != null && item.badge > 0 && (
    <span className={cn(
      'ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
      item.badgeCritical ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400',
    )}>
      {item.badge}
    </span>
  )}
</Link>
```

**Nav items definition:**
```typescript
// src/lib/admin-nav.ts
import { Users, Server, Headphones, TrendingUp, Shield } from 'lucide-react';

export const ADMIN_NAV_ITEMS = [
  { href: '/customers',  label: 'Customers', Icon: Users       },
  { href: '/fleet',      label: 'Fleet',     Icon: Server      },
  { href: '/va-queue',   label: 'VA Queue',  Icon: Headphones  }, // badge from live count
  { href: '/revenue',    label: 'Revenue',   Icon: TrendingUp  },
  { href: '/audit-log',  label: 'Audit Log', Icon: Shield      },
];
```

The VA Queue badge: fetch `GET /api/admin/va/queue?status=open&limit=0` on layout mount to get
the count of open (unassigned + in_progress) escalations. Store in React state. Mark
`badgeCritical: true` if any SLA breach exists. Do not poll; re-fetch on navigate.

**Main content area:**
```tsx
<main className="ml-52 mt-10 min-h-[calc(100vh-2.5rem)] flex-1 overflow-y-auto">
  {children}
</main>
```

Page content uses `<div className="mx-auto max-w-6xl px-8 py-6">` as the inner wrapper.

---

## Step 4: Login page

`src/app/(auth)/login/page.tsx`

No sidebar or topbar. Standalone full-screen centered.

```tsx
<div className="min-h-screen flex items-center justify-center bg-base">
  <div className="w-full max-w-sm rounded-xl border border-border bg-elevated p-8">
    <div className="mb-6">
      <p className="text-xs font-semibold tracking-widest text-text-primary">VERLOX</p>
      <p className="mt-1 text-sm text-text-muted">Admin access</p>
    </div>

    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs font-medium text-text-secondary block mb-1">Email</label>
        <input type="email" name="email" required autoFocus
               className="w-full ..."  // match existing workspace input styles
        />
      </div>
      <div>
        <label className="text-xs font-medium text-text-secondary block mb-1">Password</label>
        <input type="password" name="password" required className="w-full ..." />
      </div>

      {error && (
        <p className="text-sm text-danger">{error}</p>
      )}

      {rateLimited
        ? <p className="text-sm text-danger text-center">Too many attempts. Wait 15 minutes.</p>
        : (
          <button type="submit" disabled={loading} className="btn-admin-primary w-full">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        )
      }
    </form>
  </div>
</div>
```

No "forgot password" link. No register link. Admin accounts are created manually via the `is_admin`
flag on the users table.

---

## Step 5: Admin auth - Next.js side

**`src/app/api/auth/login/route.ts`:**

```typescript
// POST
// Body: { email: string, password: string }
// Rate limit: 5 attempts per IP per 15 minutes; return 429 after that.
//   Track attempts in a module-level Map<ip, { count, resetAt }>
//   (acceptable for single-instance admin app; use Redis if running multiple instances)
//
// 1. Call GET /api/admin/auth/check?email=[email] on core
//    with header X-Admin-Setup-Token: process.env.ADMIN_SETUP_TOKEN
// 2. If 404: return 401 { error: 'Invalid credentials' }
// 3. bcrypt.compare(password, user.passwordHash)
// 4. If mismatch: increment rate limit counter; return 401 { error: 'Invalid credentials' }
// 5. Sign a JWT: { userId, email, isAdmin: true, exp: now + 8h }
//    using ADMIN_TOKEN_SECRET with jose or jsonwebtoken
// 6. Create iron-session with { userId, email, isAdmin: true, adminToken: jwt }
// 7. Redirect to /customers
```

**`src/app/api/auth/logout/route.ts`:**

```typescript
// POST - destroy session; redirect to /login
```

**`src/middleware.ts`:**

```typescript
// All routes under /(admin) require valid admin session (isAdmin === true)
// All routes under /api/admin/* require valid admin session
// If session missing or isAdmin !== true: redirect to /login (for page routes)
//   or return 401 JSON (for /api/* routes)
// Public: /login, /api/auth/login, /api/auth/logout
```

**`src/lib/admin-api.ts`:**

```typescript
// Helper to call core from admin Next.js API routes
async function coreAdminFetch(path: string, init?: RequestInit) {
  const session = await getAdminSession(); // reads iron-session
  const res = await fetch(`${process.env.ADMIN_CORE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.adminToken}`,
      'X-Admin-Token': session.adminToken,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Core error ${res.status}`);
  }
  return res.json();
}
```

---

## Step 6: Admin auth - core backend side

**`src/admin/admin-auth.ts`:**

```typescript
// verifyAdminToken(authHeader: string | undefined): decoded JWT payload or throws 401
// Validates the Bearer token using ADMIN_TOKEN_SECRET
// Also checks that the userId in the payload has is_admin = true in the DB
```

**`src/admin/admin-middleware.ts`:**

Express/Hono middleware applied to every `/api/admin/*` route:
```typescript
// Calls verifyAdminToken; attaches decoded payload to req.adminUser
// Returns 401 if token missing or invalid signature
// Returns 403 if token valid but is_admin = false or user not found
```

**`src/admin/admin-router.ts`:**

Dedicated router for all admin routes. Mounted at `/api/admin` in the main server entry.
All routes in this router apply `admin-middleware` first.

**`GET /api/admin/auth/check`:**

```typescript
// Query: ?email=
// Returns: { userId, email, passwordHash, isAdmin }  or 404
// NOT protected by admin-middleware (used before the token exists)
// Protected by: X-Admin-Setup-Token header must match ADMIN_SETUP_TOKEN env var
// Return 401 if header missing or mismatched
```

---

## Step 7: Customers list page

`src/app/(admin)/customers/page.tsx` - server component, data fetched at render time.

**Core API route: `GET /api/admin/workspaces`**

```typescript
// Query: search (string), plan ('trial'|'starter'|'team'|'business'|'suspended'|'all'),
//         status ('trialing'|'active'|'past_due'|'at_risk'|'suspended'|'all'),
//         sort ('created_at_desc'|'last_active_desc'|'mrr_desc'), page (int), limit (default 50)
//
// 'at_risk' status filter: status = 'past_due' OR (status = 'trialing' AND trial_ends_at < NOW() + INTERVAL '3 days')
//
// Joins: workspaces + aiva_subscriptions + users (owner) + aggregate ai_workers and ai_worker_activity
//
// Returns: {
//   workspaces: Array<{
//     workspaceId, name, ownerEmail, createdAt,
//     planTier, subscriptionStatus, trialEndsAt, trialDaysRemaining,
//     aivasUsed, slotLimit,
//     monthlyAmountPence,
//     lastActiveAt,         -- MAX(ai_worker_activity.created_at) for this workspace
//     criticalSignalCount,  -- from scout_signal_cache WHERE severity='critical' AND created_at > NOW()-7d
//     warnSignalCount,      -- from scout_signal_cache WHERE severity='warning' AND created_at > NOW()-7d
//   }>,
//   total, page, limit
// }
```

**Page layout:**

```tsx
<div className="mx-auto max-w-6xl px-8 py-6">
  <div className="flex items-center justify-between mb-6">
    <div>
      <h1 className="text-2xl font-semibold text-text-primary">Customers</h1>
      <p className="text-sm text-text-muted mt-0.5">{total} workspaces</p>
    </div>
  </div>

  {/* Filter bar */}
  <div className="flex items-center gap-3 mb-4">
    <input placeholder="Workspace name or email..."
           className="flex-1 max-w-xs ..."
           value={search} onChange={...} />  {/* debounced 300ms */}
    <select value={planFilter} onChange={...}>
      <option value="all">All plans</option>
      <option value="trial">Trial</option>
      <option value="starter">Starter</option>
      <option value="team">Team</option>
      <option value="business">Business</option>
    </select>
    <select value={statusFilter} onChange={...}>
      <option value="all">All statuses</option>
      <option value="active">Active</option>
      <option value="at_risk">At risk</option>
      <option value="suspended">Suspended</option>
    </select>
    <select value={sort} onChange={...}>
      <option value="created_at_desc">Latest</option>
      <option value="last_active_desc">Last active</option>
      <option value="mrr_desc">MRR</option>
    </select>
  </div>

  {/* Table */}
  <div className="rounded-lg border border-border overflow-hidden">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border bg-overlay text-xs text-text-muted">
          <th className="text-left px-4 py-2.5 font-medium">Workspace</th>
          <th className="text-left px-4 py-2.5 font-medium">Owner</th>
          <th className="text-left px-4 py-2.5 font-medium">Plan / Status</th>
          <th className="text-left px-4 py-2.5 font-medium">Aivas</th>
          <th className="text-left px-4 py-2.5 font-medium">MRR</th>
          <th className="text-left px-4 py-2.5 font-medium">Last active</th>
          <th className="text-left px-4 py-2.5 font-medium">Signals 7d</th>
          <th />
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {workspaces.map((ws) => <CustomerRow key={ws.workspaceId} ws={ws} />)}
      </tbody>
    </table>
  </div>

  {/* Pagination */}
  <div className="flex items-center justify-between mt-4 text-xs text-text-muted">
    <span>Page {page} of {Math.ceil(total / limit)}</span>
    <div className="flex gap-2">
      <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="...">Previous</button>
      <button disabled={page * limit >= total} onClick={() => setPage(p => p + 1)} className="...">Next</button>
    </div>
  </div>
</div>
```

**`CustomerRow` component:**

Row left-border treatment:
```tsx
function rowClass(ws: WorkspaceRow) {
  if (ws.subscriptionStatus === 'suspended')
    return 'border-l-2 border-red-500/30 bg-red-500/5 opacity-80';
  if (ws.subscriptionStatus === 'past_due' ||
      (ws.subscriptionStatus === 'trialing' && ws.trialDaysRemaining <= 3))
    return 'border-l-2 border-amber-400 bg-amber-500/5';
  return 'border-l-2 border-transparent';
}
```

Plan/Status badge:
```tsx
function PlanStatusBadge({ ws }: { ws: WorkspaceRow }) {
  const configs: Record<string, { label: string; className: string }> = {
    trialing:  { label: `Trial · ${ws.trialDaysRemaining}d`,    className: 'bg-amber-500/15 text-amber-400' },
    active:    { label: `${capitalize(ws.planTier)} - Active`,  className: 'bg-green-500/10 text-green-400' },
    past_due:  { label: `${capitalize(ws.planTier)} - Past due`,className: 'bg-red-500/10 text-red-400'    },
    suspended: { label: 'Suspended',                             className: 'bg-gray-500/10 text-text-muted' },
  };
  const config = configs[ws.subscriptionStatus] ?? configs.suspended;
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${config.className}`}>
      {config.label}
    </span>
  );
}
```

Signals cell:
```tsx
function SignalCell({ ws }: { ws: WorkspaceRow }) {
  if (ws.criticalSignalCount > 0)
    return <span className="text-red-400 font-medium">!{ws.criticalSignalCount}</span>;
  if (ws.warnSignalCount > 0)
    return <span className="text-amber-400">{ws.warnSignalCount}</span>;
  return <span className="text-text-muted">0</span>;
}
```

MRR cell: `ws.monthlyAmountPence === 0 ? '-' : '£' + (ws.monthlyAmountPence / 100).toFixed(0)`.
Past-due MRR rendered in `text-red-400` (at-risk revenue).

View action: `text-xs text-accent hover:underline` link to `/customers/${ws.workspaceId}`.

---

## Step 8: Customer detail page

`src/app/(admin)/customers/[id]/page.tsx`

Two-column layout: `grid grid-cols-[1fr_288px] gap-6 items-start`.
Left column: breadcrumb + header + stats + tabs. Right column: override panel (sticky).

**Core API route: `GET /api/admin/workspaces/:id`**

```typescript
// Returns: {
//   workspace: { workspaceId, name, ownerEmail, ownerUserId, createdAt, onboardingCompletedAt },
//   subscription: { planTier, status, trialEndsAt, trialDaysRemaining, slotLimit, aivasUsed,
//                   stripeCustomerId, stripeSubscriptionId, currentPeriodEnd, gracePeriodEndsAt,
//                   cancelAtPeriodEnd, pendingDowngradeTier, monthlyAmountPence },
//   aivas: Array<{ id, name, role, status, createdAt, lastActiveAt, escalationCount,
//                  scoutRegistered, attestationCoverage }>,
//   recentActivity: Array<{ id, workerId, workerName, actionType, summary, createdAt,
//                           attestationTx }> (last 20),
//   recentSignals: Array<{ eventType, severity, summary, createdAt }> (last 10),
//   invoices: Array<{ id, stripeInvoiceId, amount, status, paidAt, invoicePdfUrl }> (last 10),
// }
```

**Page structure:**

```tsx
<div className="mx-auto max-w-6xl px-8 py-6">
  {/* Breadcrumb */}
  <nav className="text-xs text-text-muted mb-4">
    <Link href="/customers" className="hover:text-text-primary">Customers</Link>
    <span className="mx-1.5">/</span>
    <span className="text-text-primary">{workspace.name}</span>
  </nav>

  <div className="grid grid-cols-[1fr_288px] gap-6 items-start">
    {/* Left column */}
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">{workspace.name}</h1>
          <p className="text-sm text-text-muted mt-0.5">
            {workspace.ownerEmail}
            <span className="mx-1.5">·</span>
            Created {formatDate(workspace.createdAt)}
          </p>
        </div>
        <CopyIdButton id={workspace.workspaceId} />
      </div>

      {/* Stat chips */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <StatChip label="Plan" value={<PlanStatusBadge ws={{ ...workspace, ...subscription }} />} />
        <StatChip label="Aivas" value={`${subscription.aivasUsed}/${subscription.slotLimit}`} />
        <StatChip label="MRR"
                  value={subscription.monthlyAmountPence > 0
                    ? `£${(subscription.monthlyAmountPence / 100).toFixed(0)}`
                    : '-'} />
        <StatChip label="Last active" value={timeAgo(lastActiveAt)} />
      </div>

      {/* Tabs */}
      <CustomerDetailTabs workspace={workspace} subscription={subscription}
                          aivas={aivas} recentActivity={recentActivity}
                          recentSignals={recentSignals} invoices={invoices} />
    </div>

    {/* Right column - override panel */}
    <OverridePanel workspace={workspace} subscription={subscription} />
  </div>
</div>
```

`StatChip`:
```tsx
<div className="flex items-center gap-2 rounded-md border border-border bg-elevated px-3 py-1.5">
  <span className="text-xs text-text-muted">{label}:</span>
  <span className="text-xs font-medium text-text-primary">{value}</span>
</div>
```

**Tab bar (same underline style as workspace app):**

Four tabs: Aivas | Activity | Scout Signals | Billing

```tsx
<div className="border-b border-border mb-5">
  <nav className="flex gap-1 -mb-px">
    {['aivas','activity','signals','billing'].map((tab) => (
      <button
        key={tab}
        onClick={() => setActiveTab(tab)}
        className={cn(
          'px-3 py-2 text-sm border-b-2 transition-colors capitalize',
          activeTab === tab
            ? 'border-amber-400 text-text-primary font-medium'
            : 'border-transparent text-text-secondary hover:text-text-primary',
        )}
      >
        {tab === 'signals' ? 'Scout Signals' : capitalize(tab)}
      </button>
    ))}
  </nav>
</div>
```

**Aivas tab:**

```tsx
<table className="w-full text-xs">
  <thead>
    <tr className="border-b border-border text-text-muted">
      <th className="text-left py-2 pr-4 font-medium">Name</th>
      <th className="text-left py-2 pr-4 font-medium">Role</th>
      <th className="text-left py-2 pr-4 font-medium">Status</th>
      <th className="text-left py-2 pr-4 font-medium">Last active</th>
      <th className="text-left py-2 pr-4 font-medium">Escalations</th>
      <th className="text-left py-2 pr-4 font-medium">Attestation</th>
      <th />
    </tr>
  </thead>
  <tbody className="divide-y divide-border">
    {aivas.map((aiva) => (
      <tr key={aiva.id}>
        <td className="py-2 pr-4 font-medium text-text-primary">{aiva.name}</td>
        <td className="py-2 pr-4 text-text-muted">{aiva.role.slice(0,30)}</td>
        <td className="py-2 pr-4"><AivaStatusDot status={aiva.status} /></td>
        <td className="py-2 pr-4 text-text-muted">{timeAgo(aiva.lastActiveAt)}</td>
        <td className="py-2 pr-4 text-text-muted">{aiva.escalationCount}</td>
        <td className="py-2 pr-4">
          <AttestationCell coverage={aiva.attestationCoverage} />
        </td>
        <td className="py-2">
          <AivaPauseButton aivaId={aiva.id} status={aiva.status} workspaceId={workspace.workspaceId} />
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

`AttestationCell`: `text-green-400` if >= 0.95, `text-amber-400` if 0.80-0.94, `text-red-400` if < 0.80.
Format as `"94%"`.

**Activity tab:**

Feed layout, not a table:
```tsx
<div className="divide-y divide-border">
  {recentActivity.map((item) => (
    <div key={item.id} className="flex items-center gap-3 py-2.5">
      <Bot className="h-3.5 w-3.5 text-text-muted shrink-0" />
      <ActionBadge type={item.actionType} />
      <span className="text-xs text-text-secondary flex-1 truncate">{item.summary}</span>
      <span className="text-[11px] text-text-muted whitespace-nowrap shrink-0">
        {timeAgo(item.createdAt)}
      </span>
      {item.attestationTx
        ? <a href={`.../${item.attestationTx}`} target="_blank" rel="noopener noreferrer"
             className="text-[11px] text-green-400 hover:underline shrink-0">On-chain</a>
        : <span className="text-[11px] text-text-muted shrink-0">Pending</span>
      }
    </div>
  ))}
</div>
<button className="mt-3 text-xs text-accent hover:underline">Load more</button>
```

**Scout Signals tab:**

```tsx
<div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
  {recentSignals.map((sig) => (
    <div
      key={sig.id}
      className={cn(
        'flex items-center gap-3 px-4 py-2.5',
        sig.severity === 'critical' && 'bg-red-500/5 border-l-2 border-red-500/40',
        sig.severity === 'warning'  && 'bg-amber-500/5 border-l-2 border-amber-400/30',
      )}
    >
      <SeverityBadge severity={sig.severity} />
      <span className="text-xs font-mono text-text-muted">{sig.eventType}</span>
      <span className="text-xs text-text-secondary flex-1 truncate">{sig.summary}</span>
      <span className="text-[11px] text-text-muted whitespace-nowrap">{timeAgo(sig.createdAt)}</span>
    </div>
  ))}
</div>
```

`SeverityBadge`:
- critical: `bg-red-500/15 text-red-400 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded`
- warning: `bg-amber-500/15 text-amber-400 ...`
- info: `bg-gray-500/10 text-text-muted ...`

**Billing tab:**

Read-only plan display: `rounded-lg border border-border bg-elevated p-4` with "Read only" label
in top-right. Shows same plan tier, status, next renewal, Stripe customer ID (monospace) with link
to Stripe dashboard. Invoice table (same columns as Revenue page invoice table, prompt 27).

---

## Step 9: Override panel

```tsx
<div className="rounded-lg border border-amber-500/20 bg-elevated p-4 sticky top-6">
  <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 mb-4">
    Admin overrides
  </p>

  {/* Trial extension */}
  <div>
    <p className="text-xs font-medium text-text-primary mb-2">Trial extension</p>
    <div className="flex gap-2">
      <input type="number" min={1} max={90} value={extendDays} onChange={...}
             className="w-16 ..." placeholder="14" />
      <span className="text-xs text-text-muted self-center">days</span>
      <button onClick={handleExtendTrial} className="btn-admin-credit text-xs">Extend</button>
    </div>
    <p className="text-[11px] text-text-muted mt-1">
      Current: {subscription.trialEndsAt ? formatDate(subscription.trialEndsAt) : 'N/A'}
    </p>
  </div>

  <div className="admin-section-divider" />

  {/* Force plan */}
  <div>
    <p className="text-xs font-medium text-text-primary mb-2">Force plan</p>
    <select value={forcePlan} onChange={...} className="w-full text-xs ... mb-2">
      <option value="trial">Trial</option>
      <option value="starter">Starter</option>
      <option value="team">Team</option>
      <option value="business">Business</option>
      <option value="suspended">Suspended</option>
    </select>
    <input value={forceReason} onChange={...} placeholder="Reason (required)"
           className="w-full text-xs ... mb-2" />
    <button onClick={handleForcePlan} disabled={!forceReason}
            className="btn-admin-danger w-full">Apply</button>
  </div>

  <div className="admin-section-divider" />

  {/* Pause / resume all Aivas */}
  <div>
    <p className="text-xs font-medium text-text-primary mb-2">Aivas</p>
    <button onClick={handlePauseAll} className="btn-admin-danger w-full mb-1">
      Pause all ({activeAivaCount})
    </button>
    {pausedAivaCount > 0 && (
      <button onClick={handleResumeAll} className="btn-admin-credit w-full">
        Resume ({pausedAivaCount} paused)
      </button>
    )}
  </div>

  <div className="admin-section-divider" />

  {/* Add credit */}
  <div>
    <p className="text-xs font-medium text-text-primary mb-2">Add credit</p>
    <div className="flex gap-2 mb-2">
      <span className="text-xs text-text-muted self-center">£</span>
      <input type="number" min={1} value={creditAmount} onChange={...}
             className="w-20 ..." placeholder="50" />
    </div>
    <input value={creditNote} onChange={...} placeholder="Note (required)"
           className="w-full text-xs ... mb-2" />
    <button onClick={handleAddCredit} disabled={!creditAmount || !creditNote}
            className="btn-admin-credit w-full">Apply credit</button>
  </div>

  <div className="admin-section-divider" />

  {/* Notes */}
  <div>
    <p className="text-xs font-medium text-text-primary mb-2">Notes</p>
    <textarea value={notes} onChange={...} rows={3}
              className="w-full text-xs ... mb-2"
              placeholder="Internal notes about this workspace" />
    <button onClick={handleSaveNotes} className="text-xs text-text-muted hover:text-text-primary">
      Save notes
    </button>
  </div>

  {/* Feedback message below last action */}
  {feedback && (
    <p className={cn('text-xs mt-3', feedback.type === 'error' ? 'text-danger' : 'text-green-400')}>
      {feedback.message}
    </p>
  )}
</div>
```

Every mutation action:
1. Shows `window.confirm` naming the action, target, and consequence.
2. On confirm: calls the relevant `/api/admin/customers/[id]/*` route.
3. On success: sets `feedback = { type: 'ok', message: 'Done.' }`, clears after 3s, re-fetches page data.
4. On error: sets `feedback = { type: 'error', message: errorMessage }`.

---

## Step 10: Admin override proxy routes + core handlers

**Next.js proxy routes in `src/app/api/admin/customers/[id]/`:**

```
trial/route.ts     PATCH - extend trial
plan/route.ts      PATCH - force plan change
pause/route.ts     POST  - pause all Aivas
resume/route.ts    POST  - resume all Aivas
credit/route.ts    POST  - add Stripe credit
notes/route.ts     PATCH - save admin notes
aivas/route.ts     GET   - list Aivas for workspace
activity/route.ts  GET   - activity feed (limit, offset)
invoices/route.ts  GET   - invoice list
```

All routes: call `requireAdminSession(req)` first; on failure return 401. Then proxy via
`coreAdminFetch`.

**Core backend handlers in `admin-router.ts`:**

**`PATCH /api/admin/workspaces/:id/trial`**
```
Body: { extendByDays: number (1-90) }
UPDATE aiva_subscriptions SET trial_ends_at = trial_ends_at + INTERVAL '[N] days' WHERE workspace_id = $1
admin_audit_log: action='extend_trial', metadata: { extendByDays, newTrialEndsAt }
Response: { trialEndsAt }
```

**`PATCH /api/admin/workspaces/:id/plan`**
```
Body: { planTier: string, reason: string }
Calls aiva-billing.ts functions as appropriate (suspendSubscription, activateSubscription, etc.)
Updates aiva_slot_limit to match new tier.
admin_audit_log: action='force_plan_change', metadata: { previousTier, newTier, reason }
Response: { planTier, status }
```

**`POST /api/admin/workspaces/:id/pause`**
```
UPDATE ai_workers SET status = 'paused' WHERE workspace_id = $1 AND status = 'active'
admin_audit_log: action='pause_workspace_aivas', metadata: { workersPaused: count }
Response: { workersPaused }
```

**`POST /api/admin/workspaces/:id/resume`**
```
UPDATE ai_workers SET status = 'active' WHERE workspace_id = $1 AND status = 'paused'
admin_audit_log: action='resume_workspace_aivas', metadata: { workersResumed: count }
Response: { workersResumed }
```

**`POST /api/admin/workspaces/:id/credit`**
```
Body: { amount: number (GBP pence), note: string }
stripe.creditNotes.create({ customer: stripeCustomerId, amount, memo: note })
admin_audit_log: action='add_credit', metadata: { amount, note, stripeCreditNoteId }
Response: { creditNoteId, amount }
```

**`PATCH /api/admin/workspaces/:id/notes`**
```
Body: { notes: string }
UPDATE workspaces SET admin_notes = $2 WHERE id = $1
No audit log for notes (not a customer-affecting action)
Response: { saved: true }
```

---

## Step 11: Audit log page

`src/app/(admin)/audit-log/page.tsx`

**Core API route: `GET /api/admin/audit-log`**

```typescript
// Query: page, limit (default 100), action (string filter), target_type ('workspace'|'aiva'|'all'),
//         adminUserId (UUID|'all'), since (ISO date), until (ISO date), format ('json'|'csv')
// Returns JSON: Array<{ id, adminEmail, action, targetType, targetId, metadata, ipAddress, createdAt }>
// Returns CSV: same fields as comma-separated rows with header row
// admin_audit_log is joined with users to get adminEmail
```

**UI:**

```tsx
<div className="mx-auto max-w-6xl px-8 py-6">
  <div className="flex items-center justify-between mb-6">
    <h1 className="text-2xl font-semibold">Audit Log</h1>
    <a href="/api/admin/audit-log?format=csv&...currentFilters"
       className="text-xs text-accent hover:underline flex items-center gap-1">
      Export CSV <Download className="h-3 w-3" />
    </a>
  </div>

  {/* Filter bar */}
  <div className="flex items-center gap-3 mb-4 flex-wrap">
    <DateRangePicker value={dateRange} onChange={setDateRange} />
    <select value={adminFilter}>...</select>   {/* All admins or specific */}
    <select value={actionFilter}>...</select>  {/* All or specific action */}
    <select value={targetTypeFilter}>...</select>
  </div>

  {/* Table */}
  <div className="rounded-lg border border-border overflow-hidden">
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-border bg-overlay text-text-muted">
          <th className="text-left px-4 py-2.5 font-medium">Time</th>
          <th className="text-left px-4 py-2.5 font-medium">Admin</th>
          <th className="text-left px-4 py-2.5 font-medium">Action</th>
          <th className="text-left px-4 py-2.5 font-medium">Target</th>
          <th className="w-8" />
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <AuditRow key={entry.id} entry={entry} />
        ))}
      </tbody>
    </table>
  </div>
</div>
```

**`AuditRow`** with expandable metadata:

```tsx
function AuditRow({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false);
  const humanAction = ACTION_LABEL_MAP[entry.action] ?? entry.action;
  const targetLink = entry.targetType === 'workspace'
    ? `/customers/${entry.targetId}`
    : `/customers?aivaId=${entry.targetId}`; // workspace derived from metadata

  return (
    <>
      <tr className="border-b border-border hover:bg-overlay">
        <td className="px-4 py-2.5 text-text-muted whitespace-nowrap">
          {formatTimestamp(entry.createdAt)}
        </td>
        <td className="px-4 py-2.5 text-text-secondary">{entry.adminEmail}</td>
        <td className="px-4 py-2.5 text-text-primary">{humanAction}</td>
        <td className="px-4 py-2.5">
          <Link href={targetLink} className="text-accent hover:underline">
            {entry.metadata?.workspaceName ?? entry.targetId.slice(0, 8)}
          </Link>
        </td>
        <td className="px-4 py-2.5 text-center">
          <button onClick={() => setExpanded(!expanded)}
                  className="text-text-muted hover:text-text-primary">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-border">
          <td colSpan={5} className="px-4 py-3 bg-overlay">
            <pre className="text-[11px] font-mono text-text-secondary whitespace-pre-wrap">
              {JSON.stringify(entry.metadata, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}
```

**`ACTION_LABEL_MAP`:**
```typescript
const ACTION_LABEL_MAP: Record<string, string> = {
  extend_trial:           'Extended trial',
  force_plan_change:      'Force plan change',
  pause_workspace_aivas:  'Paused all Aivas',
  resume_workspace_aivas: 'Resumed all Aivas',
  add_credit:             'Added credit',
  kill_switch_pause:      'Kill switch: pause',
  kill_switch_resume:     'Kill switch: resume',
  refund:                 'Refund issued',
  va_assign:              'VA assigned',
  va_resolve:             'VA resolved',
  attestation_retry:      'Attestation retry',
  va_team_add:            'VA team member added',
  va_team_remove:         'VA team member removed',
};
```

The CSV export link includes current filter params as query string. The core route returns
`Content-Disposition: attachment; filename="admin-audit-log.csv"` when `format=csv`.

---

## Done When

**App scaffold:**
- [ ] `admin.carinaai.uk` Next.js app exists with correct package.json dependency versions
- [ ] `tailwind.config.ts` has all workspace design tokens plus `btn-admin-primary`, `btn-admin-danger`, `btn-admin-credit` utility classes in `globals.css`
- [ ] `.env.example` has all five required variables

**Login:**
- [ ] `/login` renders centered card with no sidebar or topbar
- [ ] Invalid credentials return a visible inline error message
- [ ] Rate limiting returns a static disabled state after 5 attempts in 15 minutes
- [ ] Successful login redirects to `/customers`

**Shell:**
- [ ] Amber topbar `h-10` persists on every `/(admin)` page; shows "VERLOX + ADMIN" badge on left, admin email + sign out on right
- [ ] Sidebar `w-52` shows all five nav items with correct icons
- [ ] Active nav item has amber left border and amber text
- [ ] VA Queue badge shows count of open escalations; red if any SLA breach
- [ ] Middleware blocks all `/(admin)` and `/api/admin/*` routes without valid admin session
- [ ] `/` redirects to `/customers`

**Customers list:**
- [ ] Debounced search filters by workspace name and owner email
- [ ] Plan, Status, Sort dropdowns all work; "at risk" filter shows correct rows
- [ ] Past-due and trial-expiring rows have amber left border and tinted background
- [ ] Suspended rows have red tint and reduced opacity
- [ ] Plan/Status badge shows correct color for all six states
- [ ] Signals cell shows red `!N` for critical, amber `N` for warning-only, muted `0` otherwise
- [ ] Pagination controls work

**Customer detail:**
- [ ] Breadcrumb "Customers / [name]" renders and Customers link navigates back
- [ ] Four stat chips render with correct values
- [ ] Tab bar: Aivas, Activity, Scout Signals, Billing tabs all render correct content
- [ ] Aivas table attestation cell is colored by threshold (green/amber/red)
- [ ] Activity feed renders with action badges and attestation links
- [ ] Scout Signals tab critical rows have red left border; warning rows amber
- [ ] Billing tab shows read-only plan info and invoice list

**Override panel:**
- [ ] Panel is sticky; stays in place when tab content scrolls
- [ ] Trial extension: requires days input; calls PATCH; shows new trial end date in feedback
- [ ] Force plan: requires reason field; disabled without it; calls PATCH with planTier and reason
- [ ] Pause all: shows active Aiva count; `window.confirm`; calls POST
- [ ] Resume all: only shown if paused Aivas exist; calls POST
- [ ] Add credit: requires amount and note; calls POST; returns credit note ID in feedback
- [ ] Save notes: calls PATCH; no confirm required
- [ ] Every mutation writes `admin_audit_log` row
- [ ] Feedback "Done." message appears and fades after 3 seconds on success

**Audit log:**
- [ ] Table renders with Time, Admin, Action (human-readable label), Target (linked), expand icon
- [ ] Expand row shows full metadata as formatted JSON in a `<pre>` block
- [ ] Date range, admin, action, target-type filters all work
- [ ] CSV export link downloads a file with correct Content-Disposition header

**Backend:**
- [ ] `009-aiva-admin.sql` runs without errors; all tables and indexes created
- [ ] `is_admin` column added to `users`
- [ ] `admin_notes` column added to `workspaces`
- [ ] `monthly_amount_pence` column added to `aiva_subscriptions`; existing rows back-filled
- [ ] `stripe_payment_intent_id` column added to `aiva_invoices`
- [ ] `admin-middleware.ts` verifies `X-Admin-Token` on all `/api/admin/*` core routes
- [ ] `GET /api/admin/auth/check` gated by `X-Admin-Setup-Token`, not admin JWT
- [ ] `GET /api/admin/workspaces` returns all specified fields including signal counts

**General:**
- [ ] `npx tsc --noEmit --skipLibCheck` passes
- [ ] All pages usable on a 1280px viewport minimum (admin is desktop-only; no mobile requirement)
- [ ] No em dashes in any copy, JSX strings, or SQL comments
- [ ] No emojis
