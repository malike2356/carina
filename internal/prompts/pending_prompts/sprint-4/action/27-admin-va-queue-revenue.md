# Sprint 6 - Prompt 03: VA Queue and Revenue Dashboard

**Sprint:** 6 - Aiva Admin Dashboard
**Prompt number:** 03 of 03
**Name:** Human VA escalation queue with SLA tracking, MRR/revenue dashboard, Stripe admin actions
**Primary agent:** Claude Code (backend) + Cursor (frontend)
**Estimated hours:** 10-14 h
**Depends on:** Prompt 01 (admin scaffold, auth, and `aiva_escalations` table must exist)

---

## Post-build (MANDATORY)

When all "Done When" criteria below are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Add a "**What was built:**" bullet list.
3. Move this file to `internal/prompts/archived_prompts/pending_prompts/sprint-6/aiva-admin/`.

Full checklist: `internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

---

## Read First

Before writing a single line, read these files in full:

1. `backends/servers/core.carinaai.uk/src/aiva/aiva-api.ts` - specifically the escalation handler built in sprint-4; it creates activity records with `action_type = 'escalated'`; understand how escalations are currently stored before adding the `aiva_escalations` table link
2. `backends/servers/core.carinaai.uk/src/admin/admin-router.ts` - add all new routes here
3. `backends/servers/core.carinaai.uk/src/admin/admin-auth.ts` - apply to all new routes
4. `backends/servers/core.carinaai.uk/src/billing/aiva-billing.ts` - `getAivaPricingConfig()` and `recordInvoice()` are needed for revenue aggregation
5. `backends/servers/core.carinaai.uk/src/billing/stripe-service.ts` - Stripe client for refund actions
6. `backends/servers/core.carinaai.uk/src/db/migrations/009-aiva-admin.sql` - `aiva_escalations` and `va_team_members` tables created in prompt 01; do not recreate them

---

## Context

This prompt builds two independent but related sections of the admin dashboard:

**VA Queue:** When an Aiva cannot handle a conversation (because the client asks something
outside its scope, or confidence falls below threshold, or a client explicitly requests a human),
the Aiva escalates. In sprint-4, this creates an activity record and notifies the VERLOX VA team
via webhook or email. This prompt turns that raw escalation event into a managed work item with
assignment, SLA tracking, and a resolution workflow.

**Revenue Dashboard:** The VERLOX team needs to see MRR, ARR, trial counts, at-risk accounts,
and invoice history across all customers. Revenue data comes from `aiva_subscriptions` and
`aiva_invoices` tables (created in sprint-5 billing backend). This prompt queries those tables
and adds Stripe admin actions (refund, invoice lookup).

---

## Step 1: Escalation ingestion - link sprint-4 escalations to aiva_escalations table

In sprint-4 `aiva-api.ts`, when an escalation fires, an `ai_worker_activity` record is created
with `action_type = 'escalated'`. After migration 009, a corresponding `aiva_escalations` row
must also be created at the same time.

Locate the escalation handler in `aiva-api.ts`. After the existing `logActivity()` call for an
escalation, add:

```typescript
await db.query(`
  INSERT INTO aiva_escalations
    (worker_id, workspace_id, activity_id, reason, conversation_context, priority,
     sla_first_response_target, sla_resolution_target, created_at)
  VALUES ($1, $2, $3, $4, $5, $6,
    NOW() + INTERVAL '15 minutes',
    NOW() + INTERVAL '4 hours',
    NOW())
  ON CONFLICT DO NOTHING
`, [
  workerId,
  workspaceId,
  activityId,
  escalationReason,
  JSON.stringify(conversationContext),  // last N messages before escalation
  derivePriority(escalationReason),     // see priority logic below
]);
```

**Priority logic (`derivePriority`):**
- `escalationReason` contains "urgent", "emergency", "legal", "complaint": priority = 'urgent'
- `escalationReason` contains "payment", "refund", "billing": priority = 'high'
- All other reasons: priority = 'normal'
- Automated burst detection signals from Scout (escalation_burst): priority = 'high'

Also add a DB trigger (in migration 009) to auto-update SLA breach flag:

```sql
-- Run as a cron or via a background job every minute (not a DB trigger, to avoid lock contention)
-- Alternative: compute sla_breach at read time rather than storing it
-- Preferred approach: compute at read time in the API query
-- SELECT *, (
--   CASE WHEN first_response_at IS NULL AND NOW() > sla_first_response_target THEN true
--        WHEN resolved_at IS NULL AND NOW() > sla_resolution_target THEN true
--        ELSE false
--   END
-- ) AS sla_breach
-- FROM aiva_escalations
-- Do NOT store sla_breach as a column updated by trigger; compute it in the SELECT.
-- The column in the schema from prompt 01 can remain as a cached value updated periodically.
```

---

## Step 2: Core backend - VA queue API routes

Add to `admin-router.ts`:

```
GET    /api/admin/va/queue             Paginated escalation list with filters
GET    /api/admin/va/queue/:id         Single escalation full detail
PATCH  /api/admin/va/queue/:id/assign  Assign to VA team member
PATCH  /api/admin/va/queue/:id/first-response  Mark first response time
PATCH  /api/admin/va/queue/:id/resolve Mark resolved with note
GET    /api/admin/va/team              List VA team members + availability
POST   /api/admin/va/team              Add a VA team member
PATCH  /api/admin/va/team/:id          Update availability, max_load
DELETE /api/admin/va/team/:id          Remove a VA team member
GET    /api/admin/va/sla               Aggregate SLA metrics
```

---

## Step 3: `GET /api/admin/va/queue`

```typescript
// Query params:
//   status: 'unassigned' | 'assigned' | 'in_progress' | 'resolved' | 'all' (default: all except resolved)
//   priority: 'urgent' | 'high' | 'normal' | 'low' | 'all'
//   assignedTo: UUID (VA team member ID)
//   workspaceId: UUID
//   slaBreached: boolean
//   page, limit (default 50)
//   sort: 'created_at_asc' (oldest first, default) | 'priority_desc' | 'sla_urgency'
//         sla_urgency = sort by (sla_first_response_target - NOW()) asc when unresponded,
//                        then (sla_resolution_target - NOW()) asc for responded but unresolved

// Compute sla_breach inline:
// (first_response_at IS NULL AND NOW() > sla_first_response_target)
// OR (resolved_at IS NULL AND NOW() > sla_resolution_target)

// Returns: {
//   escalations: Array<{
//     id, workerId, workerName, workspaceId, workspaceName, ownerEmail,
//     status, priority,
//     reason,
//     assignedTo: { id, name, email } | null,
//     assignedAt,
//     firstResponseAt,
//     resolvedAt,
//     resolutionNote,
//     slaFirstResponseTarget, slaResolutionTarget,
//     slaBreached,
//     minutesWaiting,       -- NOW() - created_at in minutes, null if resolved
//     minutesToFirstResponse, -- first_response_at - created_at, null if not yet responded
//     minutesToResolution,    -- resolved_at - created_at, null if not yet resolved
//     createdAt,
//   }>,
//   counts: {
//     unassigned, assigned, in_progress, resolved_today,
//     sla_breached, urgent
//   },
//   total, page, limit
// }
```

---

## Step 4: `GET /api/admin/va/queue/:id`

```typescript
// Same fields as queue list row PLUS:
// {
//   conversationContext: Array<{ role: 'user' | 'assistant', content: string, timestamp: string }>,
//   workerRole: string,
//   workerChannels: Array<{ channel, identifier }>,
//   recentWorkerActivity: Array<{ actionType, summary, createdAt }> (last 10 before escalation),
//   workspaceOwnerEmail: string,
//   workspacePlanTier: string,
//   scoutSignals: Array<{ eventType, severity, summary, createdAt }> (signals for this worker in last 1h),
// }
```

---

## Step 5: Mutation routes

**`PATCH /api/admin/va/queue/:id/assign`:**
```typescript
// Body: { assignedTo: UUID (va_team_member id) }
// 1. UPDATE aiva_escalations SET assigned_to=$1, assigned_at=NOW(), status='assigned'
// 2. Increment va_team_members.current_load for the assigned member
// 3. If status was 'unassigned' -> set to 'assigned'
// 4. admin_audit_log: action='va_assign', metadata: { escalationId, assignedToName, workerName, workspaceName }
// Return: { assigned: true, assignedTo: { id, name } }
```

**`PATCH /api/admin/va/queue/:id/first-response`:**
```typescript
// Body: {}  (no body needed; just records the timestamp)
// 1. UPDATE aiva_escalations SET first_response_at = NOW(), status = 'in_progress'
//    WHERE id = $1 AND first_response_at IS NULL
// 2. Decrement current_load is NOT done here (work is in progress)
// Return: { firstResponseAt: string }
```

**`PATCH /api/admin/va/queue/:id/resolve`:**
```typescript
// Body: { resolutionNote: string (required, min 10 chars) }
// 1. UPDATE aiva_escalations SET resolved_at = NOW(), status = 'resolved',
//          resolution_note = $2, first_response_at = COALESCE(first_response_at, NOW())
//    WHERE id = $1
// 2. Decrement va_team_members.current_load for the assigned member (if assigned)
// 3. admin_audit_log: action='va_resolve', metadata: { escalationId, resolutionNote, workerName }
// Return: { resolved: true, resolvedAt: string }
```

---

## Step 6: `GET /api/admin/va/sla`

```typescript
// Query: since (ISO date, default NOW() - INTERVAL '30 days')
// Returns: {
//   totalEscalations: number,
//   resolvedCount: number,
//   breachedCount: number,
//   breachRate: number,          -- breachedCount / totalEscalations
//   avgMinutesToFirstResponse: number,
//   avgMinutesToResolution: number,
//   p95MinutesToFirstResponse: number,
//   p95MinutesToResolution: number,
//   metFirstResponseTarget: number,   -- count where first_response_at < sla_first_response_target
//   metResolutionTarget: number,
//   firstResponseSlaRate: number,     -- metFirstResponseTarget / resolved with first_response_at
//   resolutionSlaRate: number,
//   byPriority: Array<{
//     priority: string,
//     count: number,
//     avgMinutesToResolution: number,
//     slaRate: number,
//   }>,
//   byVaMember: Array<{
//     id, name,
//     assigned: number,
//     resolved: number,
//     avgMinutesToResolution: number,
//     slaRate: number,
//   }>,
//   timeline: Array<{         -- daily counts for the `since` period
//     date: string,
//     received: number,
//     resolved: number,
//     breached: number,
//   }>
// }
```

---

## Step 7: VA team management routes

**`GET /api/admin/va/team`:**
```typescript
// Returns: Array<{
//   id, name, email, available, current_load, max_load, createdAt,
//   resolvedLast30d,   -- count from aiva_escalations WHERE assigned_to = id AND resolved_at > NOW() - INTERVAL '30 days'
//   avgResolutionMinutes
// }>
// Order: available DESC, current_load ASC
```

**`POST /api/admin/va/team`:**
```typescript
// Body: { name: string, email: string, maxLoad: number (default 5) }
// INSERT into va_team_members; return new row
// Audit log: action='va_team_add', metadata: { name, email }
```

**`PATCH /api/admin/va/team/:id`:**
```typescript
// Body: { available?: boolean, maxLoad?: number }
// UPDATE va_team_members; return updated row
// Audit log: action='va_team_update', metadata: changes
```

**`DELETE /api/admin/va/team/:id`:**
```typescript
// 1. Check if member has any open escalations (status != 'resolved')
// 2. If yes: return 409 { error: 'has_open_escalations', count: N }
//    Admin must reassign or resolve before deleting
// 3. If no: DELETE from va_team_members
// Audit log: action='va_team_remove', metadata: { name, email }
```

---

## Step 8: Revenue API routes

Add to `admin-router.ts`:

```
GET  /api/admin/revenue/summary     MRR, ARR, counts, ARPU
GET  /api/admin/revenue/at-risk     Past-due accounts + grace-ending accounts
GET  /api/admin/revenue/timeline    Monthly MRR for last 12 months
GET  /api/admin/revenue/invoices    All invoices with search/filter
POST /api/admin/revenue/refund      Trigger Stripe refund for an invoice
```

**`GET /api/admin/revenue/summary`:**

```typescript
// Queries aiva_subscriptions + aiva_invoices
// Returns: {
//   mrr: number,             -- sum of monthly_amount for active subscriptions (in GBP pence)
//   arr: number,             -- mrr * 12
//   mrrFormatted: string,    -- "4,312.00"
//   arrFormatted: string,
//   trialCount: number,      -- status = 'trialing'
//   activeCount: number,     -- status = 'active'
//   pastDueCount: number,
//   suspendedCount: number,
//   cancelledCount: number,
//   totalWorkspaces: number,
//   arpu: number,            -- mrr / activeCount (0 if activeCount = 0)
//   trialConversionRate: number,   -- activeCount / (activeCount + suspendedCount + cancelledCount)
//   newThisMonth: number,    -- subscriptions created in current calendar month
//   churnedThisMonth: number -- subscriptions cancelled in current calendar month
// }

// monthly_amount per tier (in pence):
// trial = 0, starter = 4900, team = 19900, business = 49900
// For annual subscriptions: store the monthly equivalent in a column
// If monthly_amount column does not exist on aiva_subscriptions: derive from plan_tier
// (prefer a stored column added in migration 009:
//   ALTER TABLE aiva_subscriptions ADD COLUMN IF NOT EXISTS monthly_amount_pence INTEGER NOT NULL DEFAULT 0;
//   Update existing rows after migration.)
```

**`GET /api/admin/revenue/at-risk`:**

```typescript
// Returns: {
//   pastDue: Array<{
//     workspaceId, workspaceName, ownerEmail,
//     planTier, mrr,
//     gracePeriodEndsAt, graceDaysRemaining,
//     stripeCustomerId
//   }>,
//   trialExpiringSoon: Array<{   -- trial_ends_at < NOW() + INTERVAL '3 days'
//     workspaceId, workspaceName, ownerEmail,
//     trialEndsAt, trialDaysRemaining
//   }>,
//   cancellingAtPeriodEnd: Array<{
//     workspaceId, workspaceName, ownerEmail,
//     planTier, mrr, currentPeriodEnd
//   }>
// }
```

**`GET /api/admin/revenue/timeline`:**

```typescript
// Returns 12 months of MRR data for charting
// For each month: sum active subscription monthly_amount_pence as of end of that month
// Approximation: use aiva_invoices WHERE status='paid' grouped by month
// Returns: Array<{
//   month: string,   -- "2026-06"
//   mrr: number,     -- total paid invoices in that month / 12 (approximation) OR sum of active sub amounts
//   newMrr: number,  -- subscriptions activated that month
//   churnedMrr: number  -- subscriptions cancelled that month
// }>
// Use actual subscription state changes if available; use invoice-based approximation otherwise.
```

**`GET /api/admin/revenue/invoices`:**

```typescript
// Query: search (workspace name, email, stripe invoice ID),
//         status ('paid'|'open'|'void'|'all'),
//         since, until,
//         page, limit (default 50)
// Joins aiva_invoices + aiva_subscriptions + workspaces
// Returns: Array<{
//   id, stripeInvoiceId, workspaceId, workspaceName, ownerEmail,
//   planTier, amount, currency, status, paidAt,
//   invoicePdfUrl, periodStart, periodEnd, createdAt
// }>
```

**`POST /api/admin/revenue/refund`:**

```typescript
// Body: { invoiceId: UUID, reason: 'duplicate'|'fraudulent'|'requested_by_customer', note: string }
// 1. Fetch invoice from aiva_invoices by id; get stripe_payment_intent_id
// 2. stripe.refunds.create({ payment_intent: stripePaymentIntentId, reason, metadata: { product: 'aiva', adminNote: note } })
// 3. UPDATE aiva_invoices SET status = 'refunded' WHERE id = $1
//    (add 'refunded' as a valid status if not already present)
// 4. admin_audit_log: action='refund', target_type='invoice', target_id=invoiceId,
//    metadata: { stripeRefundId, amount, reason, note, workspaceName }
// Return: { refunded: true, stripeRefundId, amount }
// On Stripe error: return 422 with { error: stripeError.message }
// aiva_invoices table needs: stripe_payment_intent_id TEXT column (add in migration 009 if missing)
//   ALTER TABLE aiva_invoices ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
```

---

## Step 9: VA Queue page UI

`src/app/(admin)/va-queue/page.tsx`

**Page layout: three-column kanban board**

Columns: Unassigned | In Progress | Resolved (today)

Column headers show count: "Unassigned (12)" with amber badge if any SLA breach.

**Card design:**

Each escalation card:
```
[priority badge: URGENT / HIGH / NORMAL]   [SLA badge: BREACHED / Xm left]
[Aiva name] - [workspace name]
[reason text - truncated to 2 lines]
[time waiting: "47 min ago"]
[assigned VA name if assigned, else "Unassigned"]
[View button]  [Quick assign dropdown]
```

Priority badge colors: urgent = red, high = amber, normal = grey.
SLA badge: red if breached, amber if < 10 min remaining to first response target, hidden otherwise.

Cards are sorted within each column: urgent first, then high, then by oldest first within same priority.

**Quick assign dropdown** on Unassigned cards:
Shows list of available VA team members (available = true, current_load < max_load).
Selecting one calls PATCH `/api/admin/va/queue/[id]/assign`; card moves to In Progress column.

**Escalation detail panel (slide-in from right):**

Clicking "View" opens a panel:

```
[header]
  [priority badge]  [Aiva name]  [workspace name]
  Escalated [X min ago] by [Aiva name] ([role])
  Channel: WhatsApp / Email / etc.

[SLA section]
  First response: [target time] - [Met / Breached / Xm remaining]
  Resolution:     [target time] - [Met / Breached / Xm remaining]

[Conversation context]
  Scrollable chat transcript (last N messages before escalation)
  User messages: right-aligned, client style
  Aiva messages: left-aligned, muted
  [ESCALATION LINE: "Aiva escalated here - reason: [reason]"]

[Assignment section]
  Currently assigned to: [VA name] / Unassigned
  [Assign to dropdown]  [Mark first response] button (disabled if already done)

[Resolution section]  (shown when status = in_progress or assigned)
  [Resolution note textarea, required, min 10 chars]
  [Mark resolved button]

[Recent Scout signals for this Aiva (last 1h)]
  If any: show warning row with event type + summary
```

**SLA overview bar** (above the kanban columns):

```
[Total open: N]  [SLA breached: N]  [Avg wait: Xm]  [Avg TTFR (last 7d): Xm]  [Avg TTR (last 7d): Xm]
```

**VA Team tab** (second tab on the VA Queue page, or a sub-nav link):

Table: Name | Email | Available | Open | Load | Resolved (30d) | Avg resolution | Actions

Available toggle: switch in the row, calls PATCH `/api/admin/va/team/[id]`

"Add team member" button at top right: inline form below table (name + email + max_load).

Remove button: shows 409 error inline if member has open escalations.

**SLA report tab** (third tab):

```
[stat row]
  First response SLA rate: X% (target: 100% in 15 min)
  Resolution SLA rate: X%    (target: 100% in 4 hours)
  Breach rate: X%
  Avg TTR: Xh Ym

[Bar chart: daily received / resolved / breached for last 30 days]

[Table: by VA member] Name | Assigned | Resolved | Avg TTR | SLA rate

[Table: by priority]  Priority | Count | Avg TTR | SLA rate
```

Chart: simple bar chart using the same charting library already in use in the codebase (check
`package.json`; if no charting library exists, use `recharts` which is compatible with React 18).

---

## Step 10: Revenue page UI

`src/app/(admin)/revenue/page.tsx`

**Stat cards row:**

| MRR | ARR | Active customers | Trial customers | ARPU | Trial conversion rate |
|-----|-----|-----------------|----------------|------|----------------------|

Color MRR card green if MRR > 0. Show formatted GBP (e.g., "4,312.00 GBP").

**MRR trend chart:**

Line chart, 12 months, three lines:
- Total MRR (blue)
- New MRR (green)
- Churned MRR (red, negative values plotted as positive with red color)

X axis: month labels (Jun, Jul, Aug...). Y axis: GBP amounts.

**Subscription breakdown donut:**

Small donut chart: Trial | Starter | Team | Business proportions.
Legend below with counts and MRR contribution per tier.

**At-risk section:**

Two tables side by side:

Left: "Payment failures" - workspace, plan, MRR, grace ends, days left, [Open portal] button.
Right: "Trials expiring in 3 days" - workspace, owner email, trial ends, [View customer] link.

Below both tables: "Cancelling at period end" collapsible list.

**Invoice history table:**

Search bar. Status filter (all / paid / open / void / refunded). Date range picker.

Table columns: Date | Workspace | Plan | Amount | Status | PDF | Actions

Status badge: Paid (green) / Open (amber) / Void (muted) / Refunded (muted red).

Actions column:
- "Download" link (opens PDF in new tab)
- "Refund" button (danger style, only on Paid invoices)

**Refund modal:**

```
[heading] Issue refund for [workspaceName]
[amount]  [amount] GBP
[reason dropdown] Requested by customer / Duplicate payment / Fraudulent
[note textarea]   Required (min 10 chars)
[buttons] [Cancel]  [Issue refund] (danger style)
```

On confirm: POST `/api/admin/revenue/refund`; on success, row status badge changes to "Refunded";
show success toast. On error: show inline error message from Stripe (e.g. "Charge already refunded").

---

## Step 11: Next.js API proxy routes

In `frontends/client-apps/admin.carinaai.uk/src/app/api/admin/`:

```
va/queue/route.ts                        GET
va/queue/[id]/route.ts                   GET
va/queue/[id]/assign/route.ts            PATCH
va/queue/[id]/first-response/route.ts    PATCH
va/queue/[id]/resolve/route.ts           PATCH
va/team/route.ts                         GET, POST
va/team/[id]/route.ts                    PATCH, DELETE
va/sla/route.ts                          GET
revenue/summary/route.ts                 GET
revenue/at-risk/route.ts                 GET
revenue/timeline/route.ts                GET
revenue/invoices/route.ts                GET
revenue/refund/route.ts                  POST
```

All routes: require admin session; attach X-Admin-Token header.

---

## Step 12: Additional DB columns (add to migration 009)

If not already included in `009-aiva-admin.sql`:

```sql
-- Monthly amount cache on subscriptions for MRR calculation
ALTER TABLE aiva_subscriptions
  ADD COLUMN IF NOT EXISTS monthly_amount_pence INTEGER NOT NULL DEFAULT 0;

-- Update existing rows based on plan tier
UPDATE aiva_subscriptions SET monthly_amount_pence = CASE plan_tier
  WHEN 'starter'  THEN 4900
  WHEN 'team'     THEN 19900
  WHEN 'business' THEN 49900
  ELSE 0
END;

-- Payment intent link on invoices for refund support
ALTER TABLE aiva_invoices
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

-- Refunded status support (add to check constraint if one exists, or just allow via application)
-- If aiva_invoices.status has a CHECK constraint, add 'refunded' to it.
```

---

## Done When

- [ ] `GET /api/admin/va/queue` returns paginated escalations with SLA breach computed inline
- [ ] Escalation ingestion: sprint-4 escalation handler inserts into `aiva_escalations` on every escalation
- [ ] Priority derived from reason text (`urgent`, `emergency`, `legal`, `complaint` -> urgent)
- [ ] VA queue page renders three-column kanban: Unassigned, In Progress, Resolved (today)
- [ ] Cards show priority badge and SLA badge with correct colors and timing
- [ ] Quick assign dropdown shows available VA members only; card moves column on assignment
- [ ] Escalation detail panel opens with full conversation context transcript
- [ ] "Mark first response" button records `first_response_at`; updates SLA display
- [ ] "Mark resolved" requires resolution note (min 10 chars); card moves to Resolved column
- [ ] VA Team tab: table shows all members with load and stats; available toggle works
- [ ] "Add team member" inline form creates a new row in `va_team_members`
- [ ] Delete VA member: returns 409 error if member has open escalations
- [ ] SLA report tab shows stat row, bar chart, and by-member and by-priority tables
- [ ] SLA API route returns all aggregated fields including timeline data
- [ ] Revenue page stat cards show MRR, ARR, active count, trial count, ARPU, conversion rate
- [ ] MRR trend chart shows 12 months with total, new, and churned lines
- [ ] Subscription donut chart shows tier breakdown with counts and MRR per tier
- [ ] At-risk section shows past-due and trial-expiring-in-3-days workspaces
- [ ] Invoice table renders with search, status filter, date range; PDF links open in new tab
- [ ] Refund modal: reason dropdown, required note, danger button; calls Stripe on confirm
- [ ] Successful refund: row status changes to "Refunded"; toast shown
- [ ] Stripe refund error: inline error message shown (not a generic "something went wrong")
- [ ] `monthly_amount_pence` column added to `aiva_subscriptions`; existing rows back-filled
- [ ] `stripe_payment_intent_id` column added to `aiva_invoices`
- [ ] All VA queue mutations and revenue refund actions written to `admin_audit_log`
- [ ] All Next.js proxy routes exist with admin session check and X-Admin-Token header
- [ ] No TypeScript errors
- [ ] No em dashes in any copy, JSX strings, or SQL comments
- [ ] No emojis
