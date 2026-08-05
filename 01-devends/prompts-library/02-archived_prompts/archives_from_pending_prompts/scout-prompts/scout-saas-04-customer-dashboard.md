# Scout SaaS -- Prompt 4 of 6: Customer Dashboard
**Status: COMPLETED 2026-07-27**

**What was built:** scout/scout-dashboard Next.js app (overview, agents, alerts, scores, keys, settings, onboarding, docs)

# Build Phase: Frontend
# Depends on: Prompt 3 (public API)
# Blocks: Prompt 6 (SDK onboarding)
# Estimated time: 8-10 hours

## Context

Customers need a dashboard at `app.scout.security` (local: scout-dashboard). Carina ops-scout is an admin view, not the customer product. Console static HTML under Propreneur is reference only; build a new Next.js app under `/opt/lampp/htdocs/verlox/scout/scout-dashboard/`.

## Technology Stack

- Next.js App Router + TypeScript + Tailwind
- Prefer lightweight UI (Radix primitives or minimal custom components). shadcn is optional, not mandatory.
- TanStack Query for server state
- Recharts for score trends
- Auth: credentials against Scout engine dashboard API (JWT cookie or Bearer). Magic link optional for v1.

## Task

### Step 1: Scaffold

Create `scout/scout-dashboard` with App Router, `src/`, Tailwind, ESLint. Proxy or call engine at `NEXT_PUBLIC_SCOUT_API_URL` (default `http://localhost:4444`).

### Step 2: Dashboard API on engine

Add session-oriented routes under `/api/dashboard/` on scout-engine (or Next.js route handlers that call the engine with a service key). Minimum:

```
POST /api/dashboard/auth/signup
POST /api/dashboard/auth/login
GET  /api/dashboard/overview
GET  /api/dashboard/agents
GET  /api/dashboard/agents/:id
GET  /api/dashboard/alerts
POST /api/dashboard/alerts/:id/resolve
GET  /api/dashboard/scores
GET  /api/dashboard/api-keys
POST /api/dashboard/api-keys
DELETE /api/dashboard/api-keys/:id
POST /api/dashboard/killswitch/:agentId
GET  /api/dashboard/org
```

Signup creates `organizations` + default workspace + first user record (add `dashboard_users` migration `009-dashboard-users.sql` if needed: email, password_hash, organization_id).

### Step 3: Screens

- `/dashboard` - agents active, alerts today, security score, API calls; score trend; recent alerts
- `/dashboard/agents` - table; detail with tools, events, kill switch
- `/dashboard/alerts` - filter by severity/status
- `/dashboard/scores` - trend + category breakdown from `scout_scores`
- `/dashboard/api-keys` - list (prefix only), create (show once), revoke
- `/dashboard/settings` - org name, plan, upgrade/manage billing placeholders (Prompt 5 wires Stripe)
- `/onboarding` - first API key + install snippet (Prompt 6 expands)

Desktop-first; tablet OK; mobile not required for v1.

### Step 4: Kill switch

Confirm dialog (type agent name) -> `POST /api/dashboard/killswitch/:agentId` -> status killed/suspended via existing control APIs.

### Step 5: Design constraints

One clear layout system (CSS variables). Avoid purple-on-white AI cliché, emoji, and card-heavy hero patterns. Dashboard may use dense panels; keep one job per page.

## Acceptance Criteria

- Signup/login works
- Overview/agents/alerts/scores/api-keys/settings render real org-scoped data
- Kill switch updates agent status
- No em dashes/en dashes; no emojis in UI copy

## Files to Reference

- Master spec: `/opt/lampp/htdocs/verlox/scout/saas-spec-master.md`
- Engine customer API: `scout/scout-engine/src/api/customer.ts`
- Console reference UI: `propreneur/.../console.labyrinthscout.com/public/`

## Post-build (MANDATORY)

Follow POST-BUILD-CHECKLIST. Batch-archive when all 6 are done.
