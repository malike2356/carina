# Sprint 4 - Prompt 27: VA Queue and Revenue Dashboard

**Sprint:** 4
**Prompt number:** 27
**Primary agent:** Claude Code (backend) + Cursor (frontend)
**Estimated hours:** 10-14 h
**Depends on:** 25-admin-auth-and-customers.md must be merged (scaffold, auth, `aiva_escalations` table must exist)

---

## Post-build (MANDATORY)

When all "Done When" criteria are satisfied:
1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Move to `internal/prompts/archived_prompts/archives_from_pending_prompts/sprint-4/action/`.

---

## Read First

Read every file listed before writing a single line of code:

1. `frontends/client-apps/admin.carinaai.uk/src/app/(admin)/layout.tsx` - admin shell; you are adding pages inside it
2. `frontends/client-apps/admin.carinaai.uk/src/lib/admin-api.ts` - helper for calling core
3. `frontends/client-apps/admin.carinaai.uk/src/app/(admin)/fleet/page.tsx` - pattern for slide-in panels and tab bars
4. `backends/servers/core.carinaai.uk/src/aiva/aiva-api.ts` - where the escalation handler lives; you will modify it
5. `backends/servers/core.carinaai.uk/src/admin/admin-router.ts` - add all new routes here
6. `backends/servers/core.carinaai.uk/src/admin/admin-auth.ts` - apply to all new routes
7. `backends/servers/core.carinaai.uk/src/billing/aiva-billing.ts` - `getAivaPricingConfig()` and `recordInvoice()`
8. `backends/servers/core.carinaai.uk/src/billing/stripe-service.ts` - Stripe client for refund actions
9. `backends/servers/core.carinaai.uk/src/db/migrations/009-aiva-admin.sql` - `aiva_escalations` and `va_team_members` tables; do not recreate them
10. `package.json` of the admin app - check if `recharts` is already installed before adding it

---

## Context

**VA Queue:** When an Aiva escalates (client requests a human, or Aiva confidence falls below
threshold), an `aiva_escalations` row is created. This page is the managed work item view:
assignment, SLA tracking, and resolution workflow for the VERLOX VA team.

**Revenue:** The VERLOX team needs MRR, ARR, trial counts, at-risk accounts, and invoice history
across all customers. Data comes from `aiva_subscriptions` and `aiva_invoices`.

Both sections are on separate pages in the same admin shell built by prompt 25.

---

## Step 1: Escalation ingestion

In `aiva-api.ts`, locate the handler that fires when an Aiva escalates. After the existing
`logActivity()` call with `action_type = 'escalated'`, add:

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
  derivePriority(escalationReason),
]);
```

**`derivePriority(reason: string): 'urgent' | 'high' | 'normal'`:**
```typescript
function derivePriority(reason: string): 'urgent' | 'high' | 'normal' {
  const r = reason.toLowerCase();
  if (/urgent|emergency|legal|complaint/.test(r)) return 'urgent';
  if (/payment|refund|billing/.test(r))           return 'high';
  return 'normal';
}
```

Scout `escalation_burst` signals should also set priority = 'high' when their payload is used
to create an escalation record.

SLA breach is computed at query time (not stored), to avoid trigger lock contention. See Step 3.

---

## Step 2: Core backend - VA queue routes

Add to `src/admin/admin-router.ts`:

```
GET    /api/admin/va/queue               Paginated escalations with filters
GET    /api/admin/va/queue/:id           Single escalation full detail
PATCH  /api/admin/va/queue/:id/assign    Assign to VA team member
PATCH  /api/admin/va/queue/:id/first-response   Mark first response
PATCH  /api/admin/va/queue/:id/resolve   Mark resolved
GET    /api/admin/va/team                List VA team members
POST   /api/admin/va/team                Add a VA team member
PATCH  /api/admin/va/team/:id            Update availability, max_load
DELETE /api/admin/va/team/:id            Remove a VA team member
GET    /api/admin/va/sla                 Aggregate SLA metrics
```

---

## Step 3: `GET /api/admin/va/queue`

```typescript
// Query params:
//   status: 'unassigned' | 'assigned' | 'in_progress' | 'resolved' | 'all'
//     default: 'unassigned,assigned,in_progress'  (all open)
//   priority: 'urgent' | 'high' | 'normal' | 'low' | 'all'
//   assignedTo: UUID
//   slaBreached: boolean
//   page (int), limit (default 50)
//   sort: 'created_at_asc' (default) | 'priority_desc' | 'sla_urgency'
//
// sla_breach computed inline:
//   (first_response_at IS NULL AND NOW() > sla_first_response_target)
//   OR (resolved_at IS NULL AND NOW() > sla_resolution_target)
//
// minutesWaiting: EXTRACT(EPOCH FROM (NOW() - created_at)) / 60
//
// Returns: {
//   escalations: Array<{
//     id, workerId, workerName, workspaceId, workspaceName, ownerEmail,
//     status, priority, reason,
//     assignedTo: { id, name, email } | null,
//     assignedAt, firstResponseAt, resolvedAt, resolutionNote,
//     slaFirstResponseTarget, slaResolutionTarget,
//     slaBreached,  -- computed inline
//     minutesWaiting,
//     minutesToFirstResponse,  -- first_response_at - created_at in minutes; null if not yet
//     minutesToResolution,     -- resolved_at - created_at in minutes; null if not yet
//     createdAt,
//   }>,
//   counts: { unassigned, assigned, in_progress, resolved_today, sla_breached, urgent },
//   total, page, limit
// }
```

---

## Step 4: `GET /api/admin/va/queue/:id`

```typescript
// All queue list fields PLUS:
// {
//   conversationContext: Array<{ role: 'user'|'assistant', content: string, timestamp: string }>,
//   workerRole: string,
//   workerChannels: Array<{ channel, identifier }>,
//   recentWorkerActivity: Array<{ actionType, summary, createdAt }> (last 10 before escalation),
//   workspaceOwnerEmail: string,
//   workspacePlanTier: string,
//   scoutSignals: Array<{ eventType, severity, summary, createdAt }> (last 1h for this worker),
// }
```

---

## Step 5: Mutation routes

**`PATCH /api/admin/va/queue/:id/assign`:**
```typescript
// Body: { assignedTo: UUID }
// UPDATE aiva_escalations SET assigned_to=$1, assigned_at=NOW(), status='assigned' WHERE id=$2
// Increment va_team_members.current_load for assigned member
// admin_audit_log: action='va_assign', metadata: { escalationId, assignedToName, workerName, workspaceName }
// Return: { assigned: true, assignedTo: { id, name } }
```

**`PATCH /api/admin/va/queue/:id/first-response`:**
```typescript
// Body: {}
// UPDATE aiva_escalations SET first_response_at = NOW(), status = 'in_progress'
//   WHERE id = $1 AND first_response_at IS NULL
// Return: { firstResponseAt: string }
```

**`PATCH /api/admin/va/queue/:id/resolve`:**
```typescript
// Body: { resolutionNote: string }  (required, min 10 chars - validated in route)
// UPDATE aiva_escalations SET resolved_at = NOW(), status = 'resolved',
//   resolution_note = $2,
//   first_response_at = COALESCE(first_response_at, NOW())
// Decrement va_team_members.current_load for assigned member (if assigned)
// admin_audit_log: action='va_resolve', metadata: { escalationId, resolutionNote, workerName }
// Return: { resolved: true, resolvedAt: string }
```

---

## Step 6: VA team management routes

**`GET /api/admin/va/team`:**
```typescript
// Returns: Array<{
//   id, name, email, available, current_load, max_load, createdAt,
//   resolvedLast30d,        -- from aiva_escalations WHERE assigned_to = id AND resolved_at > NOW()-30d
//   avgResolutionMinutes    -- AVG(EXTRACT(EPOCH FROM resolved_at - created_at)/60)
// }>
// Order: available DESC, current_load ASC
```

**`POST /api/admin/va/team`:**
```typescript
// Body: { name, email, maxLoad (default 5) }
// INSERT; return new row
// admin_audit_log: action='va_team_add', metadata: { name, email }
```

**`PATCH /api/admin/va/team/:id`:**
```typescript
// Body: { available?: boolean, maxLoad?: number }
// UPDATE; return updated row
// admin_audit_log: action='va_team_update', metadata: changes
```

**`DELETE /api/admin/va/team/:id`:**
```typescript
// 1. Check for open escalations (status != 'resolved') assigned to this member
// 2. If yes: return 409 { error: 'has_open_escalations', count: N }
// 3. DELETE from va_team_members
// admin_audit_log: action='va_team_remove', metadata: { name, email }
```

---

## Step 7: `GET /api/admin/va/sla`

```typescript
// Query: since (ISO date, default NOW() - INTERVAL '30 days')
// Returns: {
//   totalEscalations, resolvedCount, breachedCount, breachRate,
//   avgMinutesToFirstResponse, avgMinutesToResolution,
//   p95MinutesToFirstResponse, p95MinutesToResolution,
//   metFirstResponseTarget,  -- count where first_response_at < sla_first_response_target
//   metResolutionTarget,
//   firstResponseSlaRate,
//   resolutionSlaRate,
//   byPriority: Array<{ priority, count, avgMinutesToResolution, slaRate }>,
//   byVaMember: Array<{ id, name, assigned, resolved, avgMinutesToResolution, slaRate }>,
//   timeline: Array<{ date, received, resolved, breached }>  (daily for the since period)
// }
```

---

## Step 8: Revenue API routes

Add to `src/admin/admin-router.ts`:

```
GET  /api/admin/revenue/summary     MRR, ARR, counts, ARPU
GET  /api/admin/revenue/at-risk     Past-due + grace-ending + trial-expiring accounts
GET  /api/admin/revenue/timeline    Monthly MRR for last 12 months
GET  /api/admin/revenue/invoices    All invoices with search/filter
POST /api/admin/revenue/refund      Trigger Stripe refund
```

**`GET /api/admin/revenue/summary`:**
```typescript
// Returns: {
//   mrr, arr, mrrFormatted, arrFormatted,
//   trialCount, activeCount, pastDueCount, suspendedCount, cancelledCount,
//   totalWorkspaces,
//   arpu,                  -- mrr / activeCount (0 if activeCount = 0)
//   trialConversionRate,   -- activeCount / (activeCount + suspendedCount + cancelledCount)
//   newThisMonth,          -- subscriptions created in current calendar month
//   churnedThisMonth,      -- subscriptions cancelled in current calendar month
// }
// mrr = SUM(monthly_amount_pence) WHERE status IN ('active', 'past_due')
```

**`GET /api/admin/revenue/at-risk`:**
```typescript
// Returns: {
//   pastDue: Array<{ workspaceId, workspaceName, ownerEmail, planTier, monthlyAmountPence,
//                    gracePeriodEndsAt, graceDaysRemaining, stripeCustomerId }>,
//   trialExpiringSoon: Array<{ workspaceId, workspaceName, ownerEmail,
//                              trialEndsAt, trialDaysRemaining }>,
//                              -- WHERE status='trialing' AND trial_ends_at < NOW() + INTERVAL '3 days'
//   cancellingAtPeriodEnd: Array<{ workspaceId, workspaceName, ownerEmail,
//                                  planTier, monthlyAmountPence, currentPeriodEnd }>
// }
```

**`GET /api/admin/revenue/timeline`:**
```typescript
// Returns 12 months for charting
// For each month (using aiva_invoices WHERE status='paid'):
//   mrr: total paid invoice amounts / 12  (monthly equivalent)
//   newMrr: SUM for subscriptions where activated_at is in that month
//   churnedMrr: SUM for subscriptions where cancelled_at is in that month
// Returns: Array<{ month: string ('2026-06'), mrr, newMrr, churnedMrr }>
```

**`GET /api/admin/revenue/invoices`:**
```typescript
// Query: search (workspace name, email, stripe invoice ID), status, since, until, page, limit (50)
// Returns: Array<{ id, stripeInvoiceId, workspaceId, workspaceName, ownerEmail,
//                  planTier, amount, currency, status, paidAt, invoicePdfUrl,
//                  periodStart, periodEnd, createdAt, stripePaymentIntentId }>
```

**`POST /api/admin/revenue/refund`:**
```typescript
// Body: { invoiceId: UUID, reason: 'duplicate'|'fraudulent'|'requested_by_customer', note: string }
// 1. Fetch invoice from aiva_invoices; get stripe_payment_intent_id
// 2. stripe.refunds.create({ payment_intent: stripePaymentIntentId, reason, metadata: { ... } })
// 3. UPDATE aiva_invoices SET status = 'refunded' WHERE id = $1
// 4. admin_audit_log: action='refund', target_type='invoice', target_id=invoiceId,
//    metadata: { stripeRefundId, amount, reason, note, workspaceName }
// Return: { refunded: true, stripeRefundId, amount }
// On Stripe error: 422 { error: stripeError.message }
```

---

## Step 9: Next.js API proxy routes

In `src/app/api/admin/`:

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

All routes: `requireAdminSession(req)` first; attach `X-Admin-Token` header.

---

## Step 10: VA Queue page UI

`src/app/(admin)/va-queue/page.tsx`

Three tabs: **Queue** | **Team** | **SLA Report**

Page header:
```tsx
<div className="flex items-center justify-between mb-6">
  <div>
    <h1 className="text-2xl font-semibold">VA Queue</h1>
  </div>
</div>

{/* SLA overview bar */}
<div className="flex items-center gap-6 mb-5 text-xs">
  <SlaStatPill label="Total open"    value={counts.unassigned + counts.assigned + counts.in_progress} />
  <SlaStatPill label="SLA breached"  value={counts.sla_breached}  danger={counts.sla_breached > 0} />
  <SlaStatPill label="Urgent"        value={counts.urgent}         danger={counts.urgent > 0} />
  <SlaStatPill label="Avg wait"      value={`${avgMinutesWaiting}m`} />
  <SlaStatPill label="Avg TTFR 7d"   value={`${sla?.avgMinutesToFirstResponse ?? '-'}m`} />
  <SlaStatPill label="Avg TTR 7d"    value={`${sla?.avgMinutesToResolution ?? '-'}m`} />
</div>
```

`SlaStatPill`:
```tsx
function SlaStatPill({ label, value, danger }: { label: string; value: React.ReactNode; danger?: boolean }) {
  return (
    <div className={cn(
      'flex items-center gap-1.5 px-3 py-1.5 rounded-md border',
      danger ? 'border-red-500/30 bg-red-500/10' : 'border-border bg-elevated',
    )}>
      <span className="text-text-muted">{label}:</span>
      <span className={cn('font-medium', danger ? 'text-red-400' : 'text-text-primary')}>{value}</span>
    </div>
  );
}
```

Tab bar: amber underline pattern (same as other admin pages).

---

### Queue tab - Kanban board

```tsx
<div className="grid grid-cols-3 gap-4">
  <KanbanColumn
    title="Unassigned"
    count={unassigned.length}
    breachCount={unassigned.filter(e => e.slaBreached).length}
    escalations={unassigned}
    onView={setDetailEscalation}
  />
  <KanbanColumn
    title="In Progress"
    count={inProgress.length}
    breachCount={inProgress.filter(e => e.slaBreached).length}
    escalations={inProgress}
    onView={setDetailEscalation}
  />
  <KanbanColumn
    title="Resolved Today"
    count={resolvedToday.length}
    breachCount={0}
    escalations={resolvedToday}
    onView={setDetailEscalation}
  />
</div>
```

**`KanbanColumn`:**

```tsx
function KanbanColumn({ title, count, breachCount, escalations, onView }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-medium text-text-primary">{title}</h3>
        <span className="text-xs bg-overlay px-1.5 py-0.5 rounded text-text-muted">{count}</span>
        {breachCount > 0 && (
          <span className="text-xs bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded">
            {breachCount} breached
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2 h-[calc(100vh-300px)] overflow-y-auto pr-1">
        {escalations.map((e) => <EscalationCard key={e.id} escalation={e} onView={onView} />)}
        {escalations.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <p className="text-xs text-text-muted">No items</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

**`EscalationCard`:**

```tsx
function EscalationCard({ escalation: e, onView }) {
  const cardClass = cn(
    'rounded-lg border p-3 flex flex-col gap-2',
    e.slaBreached      ? 'border-red-500/30 bg-red-500/5'    :
    e.priority === 'urgent' ? 'border-amber-500/20 bg-elevated' :
    'border-border bg-elevated',
  );

  return (
    <div className={cardClass}>
      {/* Header row: priority badge + SLA badge */}
      <div className="flex items-center justify-between">
        {e.priority !== 'normal' && <PriorityBadge priority={e.priority} />}
        {e.priority === 'normal' && <span />}
        <SlaBadge escalation={e} />
      </div>

      {/* Aiva + workspace */}
      <div>
        <p className="text-xs font-medium text-text-primary">{e.workerName} - {e.workspaceName}</p>
      </div>

      {/* Reason - 2 lines max */}
      <p className="text-[11px] text-text-secondary line-clamp-2">
        "{e.reason}"
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div className="text-[11px] text-text-muted">
          {formatMinutes(e.minutesWaiting)} ago
          {e.assignedTo && (
            <span className="ml-1.5 text-text-secondary">{e.assignedTo.name}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {e.status === 'unassigned' && <QuickAssignDropdown escalationId={e.id} />}
          <button
            type="button"
            onClick={() => onView(e.id)}
            className="text-[11px] text-accent hover:underline"
          >
            View
          </button>
        </div>
      </div>
    </div>
  );
}
```

**`PriorityBadge`:**
```tsx
function PriorityBadge({ priority }: { priority: string }) {
  const config = {
    urgent: 'bg-red-500/15 text-red-400',
    high:   'bg-amber-500/15 text-amber-400',
  }[priority];
  if (!config) return null;
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${config}`}>
      {priority}
    </span>
  );
}
```

**`SlaBadge`:**
```tsx
function SlaBadge({ escalation: e }: { escalation: Escalation }) {
  if (e.slaBreached)
    return <span className="text-[10px] font-semibold text-red-400">BREACHED</span>;

  if (!e.firstResponseAt) {
    const minsLeft = Math.round(
      (new Date(e.slaFirstResponseTarget).getTime() - Date.now()) / 60000
    );
    if (minsLeft <= 10)
      return <span className="text-[10px] text-amber-400">{minsLeft}m</span>;
  }
  return null;
}
```

**`QuickAssignDropdown`:**
```tsx
// Fetch available VA team members (available=true, current_load < max_load) on mount
// Renders a <select> - selecting one calls PATCH /api/admin/va/queue/[id]/assign
// On success: optimistic update - move card to "In Progress" column in parent state
// No confirm required for assignment (low-risk action)
```

Cards sorted within each column: urgent first, then high priority, then oldest first within same priority.

---

### Escalation detail panel

Triggered by `onView(escalationId)`. Fetches `GET /api/admin/va/queue/[id]` on open.

```
fixed right-0 top-10 bottom-0 w-[560px] bg-elevated border-l border-border z-50 flex flex-col
```

Backdrop + slide-in: same pattern as Fleet page drawer.

```tsx
<div className={cn(
  'fixed right-0 top-10 bottom-0 w-[560px] bg-elevated border-l border-border z-50',
  'flex flex-col transition-transform duration-200',
  detailEscalation ? 'translate-x-0' : 'translate-x-full',
)}>
  {/* Header */}
  <div className="flex items-start justify-between p-4 border-b border-border shrink-0">
    <div>
      <div className="flex items-center gap-2 mb-0.5">
        {detail?.priority !== 'normal' && <PriorityBadge priority={detail?.priority} />}
        <h2 className="text-base font-semibold text-text-primary">
          {detail?.workerName} - {detail?.workspaceName}
        </h2>
      </div>
      <p className="text-xs text-text-muted">
        Escalated via {detail?.workerChannels?.[0]?.channel ?? 'unknown channel'}
        {' · '}
        {detail ? formatMinutes(detail.minutesWaiting) + ' ago' : ''}
      </p>
      {detail?.slaBreached && (
        <p className="text-xs text-red-400 mt-0.5 font-medium">SLA breached</p>
      )}
    </div>
    <button onClick={() => setDetailEscalation(null)}
            className="text-text-muted hover:text-text-primary">
      <X className="h-4 w-4" />
    </button>
  </div>

  {/* SLA tracker */}
  <div className="px-4 py-3 border-b border-border bg-overlay shrink-0">
    <div className="grid grid-cols-2 gap-4">
      <SlaTracker
        label="First response"
        target={detail?.slaFirstResponseTarget}
        achieved={detail?.firstResponseAt}
        isFirstResponse
      />
      <SlaTracker
        label="Resolution"
        target={detail?.slaResolutionTarget}
        achieved={detail?.resolvedAt}
      />
    </div>
  </div>

  {/* Scrollable body */}
  <div className="flex-1 overflow-y-auto">
    {/* Conversation context */}
    <div className="p-4 border-b border-border">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-3">
        Conversation
      </p>
      <div className="space-y-1 max-h-48 overflow-y-auto rounded-lg border border-border p-3">
        {detail?.conversationContext.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'text-[11px] rounded-lg px-3 py-2',
              msg.role === 'user'
                ? 'ml-8 bg-accent-dim text-text-primary text-right'
                : 'mr-8 border border-border text-text-secondary',
            )}
          >
            {msg.content}
          </div>
        ))}
        <div className="text-[10px] text-red-400 text-center my-2 pt-2 border-t border-red-500/20">
          Aiva escalated here - reason: "{detail?.reason}"
        </div>
      </div>
    </div>

    {/* Assignment */}
    <div className="p-4 border-b border-border">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-3">
        Assignment
      </p>
      <div className="flex items-center gap-3 mb-3">
        <select
          value={assignTo}
          onChange={(e) => setAssignTo(e.target.value)}
          className="flex-1 text-xs ..."
        >
          <option value="">Unassigned</option>
          {teamMembers.filter(m => m.available && m.current_load < m.max_load).map((m) => (
            <option key={m.id} value={m.id}>{m.name} ({m.current_load}/{m.max_load})</option>
          ))}
        </select>
        <button
          onClick={handleAssign}
          disabled={!assignTo || assignTo === detail?.assignedTo?.id}
          className="btn-admin-credit text-xs"
        >
          Assign
        </button>
      </div>
      <button
        onClick={handleMarkFirstResponse}
        disabled={!!detail?.firstResponseAt}
        className={cn(
          'text-xs w-full py-1.5 rounded border transition-colors',
          detail?.firstResponseAt
            ? 'border-border text-text-muted opacity-40 cursor-default'
            : 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10',
        )}
      >
        {detail?.firstResponseAt ? 'First response recorded' : 'Mark first response'}
      </button>
    </div>

    {/* Resolution */}
    {detail?.status !== 'resolved' && (
      <div className="p-4 border-b border-border">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-3">
          Resolution
        </p>
        <textarea
          value={resolutionNote}
          onChange={(e) => setResolutionNote(e.target.value)}
          rows={3}
          placeholder="Describe how this was resolved (min 10 characters)"
          className="w-full text-xs ... mb-2"
        />
        <button
          onClick={handleResolve}
          disabled={resolutionNote.length < 10 || resolving}
          className="btn-admin-primary w-full text-xs"
        >
          {resolving ? 'Resolving...' : 'Mark resolved'}
        </button>
      </div>
    )}

    {/* Scout signals */}
    {detail?.scoutSignals && detail.scoutSignals.length > 0 && (
      <div className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2">
          Scout signals for {detail.workerName} (last 1h)
        </p>
        {detail.scoutSignals.map((sig) => (
          <div key={sig.id} className="flex items-center gap-2 py-1.5 text-[11px]">
            <SeverityBadge severity={sig.severity} />
            <span className="text-text-muted font-mono">{sig.eventType}</span>
            <span className="text-text-secondary flex-1 truncate">{sig.summary}</span>
          </div>
        ))}
      </div>
    )}
  </div>
</div>
```

**`SlaTracker`:**

```tsx
function SlaTracker({ label, target, achieved, isFirstResponse }) {
  const targetDate = target ? new Date(target) : null;
  const now = Date.now();
  const minsLeft = targetDate ? Math.round((targetDate.getTime() - now) / 60000) : null;
  const breached = !achieved && targetDate && targetDate.getTime() < now;
  const met      = !!achieved && targetDate && new Date(achieved) < targetDate;

  return (
    <div>
      <p className="text-[10px] text-text-muted mb-0.5">{label}</p>
      {achieved ? (
        <p className="text-xs text-green-400">Met - {timeAgo(achieved)}</p>
      ) : breached ? (
        <p className="text-xs text-red-400 font-medium">
          Overdue by {Math.abs(minsLeft!)}m
        </p>
      ) : minsLeft !== null ? (
        <p className={cn('text-xs', minsLeft <= 10 ? 'text-amber-400' : 'text-text-secondary')}>
          {minsLeft}m remaining
        </p>
      ) : (
        <p className="text-xs text-text-muted">-</p>
      )}
      {targetDate && (
        <p className="text-[10px] text-text-muted">Target: {formatTimestamp(target)}</p>
      )}
    </div>
  );
}
```

On successful resolution: close the detail panel, move the card to the Resolved Today column
(optimistic update in parent state). Re-fetch the counts for the SLA overview bar.

---

### Team tab

```tsx
<div>
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-sm font-medium text-text-primary">VA team</h2>
    <button onClick={() => setShowAddForm(true)} className="btn-admin-credit text-xs">
      + Add team member
    </button>
  </div>

  {showAddForm && (
    <div className="flex items-center gap-2 mb-4 p-3 rounded-lg border border-border bg-overlay">
      <input value={newName}  onChange={...} placeholder="Name"     className="text-xs ..." />
      <input value={newEmail} onChange={...} placeholder="Email"    className="text-xs ..." />
      <input value={newMaxLoad} type="number" min={1} max={20}
             onChange={...}   placeholder="Max load" className="w-20 text-xs ..." />
      <button onClick={handleAdd}    className="btn-admin-credit text-xs">Add</button>
      <button onClick={() => setShowAddForm(false)} className="text-xs text-text-muted hover:text-text-primary">Cancel</button>
    </div>
  )}

  <div className="rounded-lg border border-border overflow-hidden">
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-border bg-overlay text-[11px] text-text-muted">
          <th className="text-left px-4 py-2.5 font-medium">Name</th>
          <th className="text-left px-4 py-2.5 font-medium">Email</th>
          <th className="text-left px-4 py-2.5 font-medium">Available</th>
          <th className="text-left px-4 py-2.5 font-medium">Open</th>
          <th className="text-left px-4 py-2.5 font-medium">Load</th>
          <th className="text-left px-4 py-2.5 font-medium">Resolved 30d</th>
          <th className="text-left px-4 py-2.5 font-medium">Avg TTR</th>
          <th className="w-16" />
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {teamMembers.map((m) => (
          <tr key={m.id} className={cn(m.available ? '' : 'opacity-60')}>
            <td className="px-4 py-2.5 font-medium text-text-primary">{m.name}</td>
            <td className="px-4 py-2.5 text-text-muted">{m.email}</td>
            <td className="px-4 py-2.5">
              <AvailableToggle memberId={m.id} available={m.available} />
            </td>
            <td className="px-4 py-2.5 text-text-muted">{m.current_load}</td>
            <td className="px-4 py-2.5">
              <LoadBar current={m.current_load} max={m.max_load} />
            </td>
            <td className="px-4 py-2.5 text-text-muted">{m.resolvedLast30d}</td>
            <td className="px-4 py-2.5 text-text-muted">
              {m.avgResolutionMinutes ? formatMinutes(m.avgResolutionMinutes) : '-'}
            </td>
            <td className="px-4 py-2.5">
              <RemoveMemberButton memberId={m.id} name={m.name} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>
```

**`AvailableToggle`:** Calls `PATCH /api/admin/va/team/[id]` with `{ available }` on change. Optimistic update.

**`LoadBar`:**
```tsx
function LoadBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? (current / max) : 0;
  const colorClass = pct < 0.8 ? 'bg-green-400' : pct < 1 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-overlay overflow-hidden">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${Math.min(pct * 100, 100)}%` }} />
      </div>
      <span className="text-[11px] text-text-muted">{current}/{max}</span>
    </div>
  );
}
```

**`RemoveMemberButton`:** Calls `DELETE /api/admin/va/team/[id]`. On 409 response: show an inline
error below the row `text-xs text-danger "Has N open escalations. Reassign first."`. On success:
remove from table state.

---

### SLA Report tab

```tsx
<div className="space-y-6">
  {/* Stat row */}
  <div className="grid grid-cols-4 gap-3">
    <SlaKpiCard label="First response SLA" value={`${(sla.firstResponseSlaRate * 100).toFixed(0)}%`}
                sub="target: 100% in 15 min" good={sla.firstResponseSlaRate >= 0.9} />
    <SlaKpiCard label="Resolution SLA" value={`${(sla.resolutionSlaRate * 100).toFixed(0)}%`}
                sub="target: 100% in 4h" good={sla.resolutionSlaRate >= 0.9} />
    <SlaKpiCard label="Breach rate" value={`${(sla.breachRate * 100).toFixed(1)}%`}
                sub={`${sla.breachedCount} of ${sla.totalEscalations}`}
                good={sla.breachRate < 0.1} />
    <SlaKpiCard label="Avg TTR" value={formatMinutes(sla.avgMinutesToResolution)}
                sub={`p95: ${formatMinutes(sla.p95MinutesToResolution)}`}
                good={sla.avgMinutesToResolution < 240} />
  </div>

  {/* Bar chart */}
  <div>
    <h3 className="text-sm font-medium text-text-primary mb-3">Daily escalations (last 30 days)</h3>
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={sla.timeline} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
        <YAxis tick={{ fontSize: 10 }} width={30} />
        <Tooltip contentStyle={{ fontSize: 11 }} />
        <Bar dataKey="received"  name="Received"  fill="#1a5f7a" radius={[2,2,0,0]} />
        <Bar dataKey="resolved"  name="Resolved"  fill="#4ade80" radius={[2,2,0,0]} />
        <Bar dataKey="breached"  name="Breached"  fill="#f87171" radius={[2,2,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  </div>

  {/* By VA member + by priority */}
  <div className="grid grid-cols-2 gap-6">
    <div>
      <h3 className="text-sm font-medium text-text-primary mb-3">By VA member</h3>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-[11px] text-text-muted">
            <th className="text-left py-1.5 font-medium">Name</th>
            <th className="text-right py-1.5 font-medium">Assigned</th>
            <th className="text-right py-1.5 font-medium">Resolved</th>
            <th className="text-right py-1.5 font-medium">Avg TTR</th>
            <th className="text-right py-1.5 font-medium">SLA %</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sla.byVaMember.map((m) => (
            <tr key={m.id}>
              <td className="py-1.5 text-text-primary">{m.name}</td>
              <td className="py-1.5 text-right text-text-muted">{m.assigned}</td>
              <td className="py-1.5 text-right text-text-muted">{m.resolved}</td>
              <td className="py-1.5 text-right text-text-muted">{formatMinutes(m.avgMinutesToResolution)}</td>
              <td className={cn('py-1.5 text-right font-medium', slaRateColor(m.slaRate))}>
                {(m.slaRate * 100).toFixed(0)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <div>
      <h3 className="text-sm font-medium text-text-primary mb-3">By priority</h3>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-[11px] text-text-muted">
            <th className="text-left py-1.5 font-medium">Priority</th>
            <th className="text-right py-1.5 font-medium">Count</th>
            <th className="text-right py-1.5 font-medium">Avg TTR</th>
            <th className="text-right py-1.5 font-medium">SLA %</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sla.byPriority.map((p) => (
            <tr key={p.priority}>
              <td className="py-1.5">
                {p.priority !== 'normal' ? <PriorityBadge priority={p.priority} /> : <span className="text-text-muted">Normal</span>}
              </td>
              <td className="py-1.5 text-right text-text-muted">{p.count}</td>
              <td className="py-1.5 text-right text-text-muted">{formatMinutes(p.avgMinutesToResolution)}</td>
              <td className={cn('py-1.5 text-right font-medium', slaRateColor(p.slaRate))}>
                {(p.slaRate * 100).toFixed(0)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
</div>
```

`slaRateColor(rate)`: green if >= 0.9, amber if 0.7-0.89, red if < 0.7.

**Chart dependency:** Use `recharts`. If not in `package.json`, add `recharts` at the same version
used elsewhere in the monorepo, or the latest stable version. Import:
`import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'`.
No animation (admin tool): add `isAnimationActive={false}` to each `<Bar>`.

---

## Step 11: Revenue page UI

`src/app/(admin)/revenue/page.tsx`

```tsx
<div className="mx-auto max-w-6xl px-8 py-6">
  <h1 className="text-2xl font-semibold mb-6">Revenue</h1>

  {/* Stat cards */}
  <div className="grid grid-cols-6 gap-3 mb-6">
    <RevenueCard label="MRR"        value={summary.mrrFormatted}     highlight />
    <RevenueCard label="ARR"        value={summary.arrFormatted} />
    <RevenueCard label="Active"     value={summary.activeCount} />
    <RevenueCard label="Trial"      value={summary.trialCount} />
    <RevenueCard label="ARPU"       value={`£${(summary.arpu / 100).toFixed(2)}`} />
    <RevenueCard label="Conversion" value={`${(summary.trialConversionRate * 100).toFixed(0)}%`} />
  </div>

  {/* MRR trend chart */}
  <div className="rounded-lg border border-border bg-elevated p-4 mb-6">
    <h2 className="text-sm font-medium text-text-primary mb-4">MRR trend (12 months)</h2>
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={timeline} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={(m) => m.slice(5)} />
        <YAxis tick={{ fontSize: 10 }} width={50}
               tickFormatter={(v) => `£${(v/100).toFixed(0)}`} />
        <Tooltip formatter={(v: number) => `£${(v/100).toFixed(2)}`}
                 contentStyle={{ fontSize: 11 }} />
        <Line dataKey="mrr"      name="Total MRR"   stroke="#f5a623" strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line dataKey="newMrr"   name="New MRR"     stroke="#4ade80" strokeWidth={1.5} dot={false} isAnimationActive={false} strokeDasharray="4 2" />
        <Line dataKey="churnedMrr" name="Churned" stroke="#f87171" strokeWidth={1.5} dot={false} isAnimationActive={false} strokeDasharray="4 2" />
      </LineChart>
    </ResponsiveContainer>
  </div>

  {/* Tier breakdown + at-risk */}
  <div className="grid grid-cols-[1fr_1fr] gap-6 mb-6">

    {/* Tier breakdown */}
    <div className="rounded-lg border border-border bg-elevated p-4">
      <h2 className="text-sm font-medium text-text-primary mb-3">Subscriptions by tier</h2>
      <table className="w-full text-xs mb-3">
        <thead>
          <tr className="border-b border-border text-[11px] text-text-muted">
            <th className="text-left py-1.5 font-medium">Tier</th>
            <th className="text-right py-1.5 font-medium">Count</th>
            <th className="text-right py-1.5 font-medium">MRR</th>
            <th className="text-right py-1.5 font-medium">%</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {TIER_ORDER.map((tier) => {
            const count = tierCounts[tier] ?? 0;
            const mrr   = tierMrr[tier] ?? 0;
            const pct   = summary.mrr > 0 ? (mrr / summary.mrr * 100).toFixed(0) : 0;
            return (
              <tr key={tier}>
                <td className="py-1.5 capitalize text-text-secondary">{tier}</td>
                <td className="py-1.5 text-right text-text-muted">{count}</td>
                <td className="py-1.5 text-right text-text-muted">
                  {mrr > 0 ? `£${(mrr/100).toFixed(0)}` : '-'}
                </td>
                <td className="py-1.5 text-right text-text-muted">{pct}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {/* Proportional bar */}
      <div className="h-1.5 w-full rounded-full flex overflow-hidden">
        <div style={{ width: `${tierPct('trial')}%` }}   className="bg-gray-600" />
        <div style={{ width: `${tierPct('starter')}%` }} className="bg-blue-500/60" />
        <div style={{ width: `${tierPct('team')}%` }}    className="bg-teal-500/60" />
        <div style={{ width: `${tierPct('business')}%` }}className="bg-amber-500/60" />
      </div>
      <div className="flex gap-3 mt-1.5 text-[10px] text-text-muted">
        <span><span className="inline-block w-2 h-2 rounded-sm bg-gray-600 mr-0.5" />Trial</span>
        <span><span className="inline-block w-2 h-2 rounded-sm bg-blue-500/60 mr-0.5" />Starter</span>
        <span><span className="inline-block w-2 h-2 rounded-sm bg-teal-500/60 mr-0.5" />Team</span>
        <span><span className="inline-block w-2 h-2 rounded-sm bg-amber-500/60 mr-0.5" />Business</span>
      </div>
    </div>

    {/* At-risk */}
    <div className="space-y-3">
      <AtRiskPanel
        title={`Payment failures (${atRisk.pastDue.length})`}
        items={atRisk.pastDue}
        renderItem={(item) => (
          <>
            <Link href={`/customers/${item.workspaceId}`} className="text-accent hover:underline">
              {item.workspaceName}
            </Link>
            <span className="text-text-muted capitalize">{item.planTier}</span>
            <span className="text-text-muted">
              {item.monthlyAmountPence > 0 ? `£${(item.monthlyAmountPence/100).toFixed(0)}/mo` : '-'}
            </span>
            <span className={item.graceDaysRemaining <= 2 ? 'text-red-400' : 'text-amber-400'}>
              {item.graceDaysRemaining}d left
            </span>
          </>
        )}
      />
      <AtRiskPanel
        title={`Trials expiring in 3 days (${atRisk.trialExpiringSoon.length})`}
        items={atRisk.trialExpiringSoon}
        renderItem={(item) => (
          <>
            <Link href={`/customers/${item.workspaceId}`} className="text-accent hover:underline">
              {item.workspaceName}
            </Link>
            <span className="text-text-muted">{item.ownerEmail}</span>
            <span className="text-amber-400">{item.trialDaysRemaining}d left</span>
          </>
        )}
      />
    </div>
  </div>

  {/* Invoice history */}
  <div>
    <h2 className="text-sm font-medium text-text-primary mb-3">Invoice history</h2>
    <div className="flex items-center gap-3 mb-3">
      <input placeholder="Workspace, email, or invoice ID..." className="flex-1 max-w-xs text-xs ..." />
      <select className="text-xs ...">
        <option value="all">All statuses</option>
        <option value="paid">Paid</option>
        <option value="open">Open</option>
        <option value="void">Void</option>
        <option value="refunded">Refunded</option>
      </select>
      <DateRangePicker value={dateRange} onChange={setDateRange} />
    </div>
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-overlay text-[11px] text-text-muted">
            <th className="text-left px-4 py-2.5 font-medium">Date</th>
            <th className="text-left px-4 py-2.5 font-medium">Workspace</th>
            <th className="text-left px-4 py-2.5 font-medium">Plan</th>
            <th className="text-right px-4 py-2.5 font-medium">Amount</th>
            <th className="text-left px-4 py-2.5 font-medium">Status</th>
            <th className="text-left px-4 py-2.5 font-medium">PDF</th>
            <th className="w-16" />
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => <InvoiceRow key={inv.id} invoice={inv} onRefund={handleRefund} />)}
        </tbody>
      </table>
    </div>
  </div>
</div>
```

**`RevenueCard`:**
```tsx
function RevenueCard({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-elevated p-4">
      <p className={cn(
        'font-semibold',
        highlight ? 'text-3xl text-amber-400' : 'text-2xl text-text-primary',
      )}>
        {value}
      </p>
      <p className="text-xs text-text-muted mt-0.5">{label}</p>
    </div>
  );
}
```

**`AtRiskPanel`:**
```tsx
function AtRiskPanel({ title, items, renderItem }) {
  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
      <p className="text-xs font-medium text-amber-400 mb-2">{title}</p>
      {items.length === 0
        ? <p className="text-[11px] text-text-muted">None</p>
        : items.slice(0, 3).map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px] py-0.5">
            {renderItem(item)}
          </div>
        ))
      }
      {items.length > 3 && (
        <p className="text-[11px] text-text-muted mt-1">+{items.length - 3} more</p>
      )}
    </div>
  );
}
```

**`InvoiceRow`:**
```tsx
function InvoiceRow({ invoice: inv, onRefund }) {
  const statusConfig: Record<string, string> = {
    paid:     'bg-green-500/10 text-green-400',
    open:     'bg-amber-500/10 text-amber-400',
    void:     'bg-gray-500/10 text-text-muted',
    refunded: 'bg-red-500/10 text-red-400/70',
  };
  return (
    <tr className="border-b border-border group">
      <td className="px-4 py-2.5 text-text-muted">{formatDate(inv.createdAt)}</td>
      <td className="px-4 py-2.5">
        <Link href={`/customers/${inv.workspaceId}`} className="text-accent hover:underline">
          {inv.workspaceName}
        </Link>
      </td>
      <td className="px-4 py-2.5 text-text-muted capitalize">{inv.planTier}</td>
      <td className="px-4 py-2.5 text-right text-text-primary">
        £{(inv.amount / 100).toFixed(2)}
      </td>
      <td className="px-4 py-2.5">
        <span className={`text-[11px] px-2 py-0.5 rounded-full ${statusConfig[inv.status] ?? ''}`}>
          {capitalize(inv.status)}
        </span>
      </td>
      <td className="px-4 py-2.5">
        {inv.invoicePdfUrl && (
          <a href={inv.invoicePdfUrl} target="_blank" rel="noopener noreferrer"
             className="text-accent hover:underline text-[11px]">
            PDF
          </a>
        )}
      </td>
      <td className="px-4 py-2.5">
        {inv.status === 'paid' && (
          <button
            onClick={() => onRefund(inv)}
            className="text-[11px] text-red-400 hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Refund
          </button>
        )}
      </td>
    </tr>
  );
}
```

**Refund modal:**
```tsx
<dialog ref={refundDialogRef} className="rounded-xl border border-border bg-elevated p-6 w-full max-w-md backdrop:bg-black/50">
  <h2 className="text-base font-semibold text-text-primary mb-1">
    Issue refund for {refundTarget?.workspaceName}
  </h2>
  <p className="text-sm text-text-muted mb-4">
    £{refundTarget ? (refundTarget.amount / 100).toFixed(2) : '-'}
  </p>
  <div className="space-y-3 mb-4">
    <div>
      <label className="text-xs font-medium text-text-secondary block mb-1">Reason</label>
      <select value={refundReason} onChange={(e) => setRefundReason(e.target.value)} className="w-full text-xs ...">
        <option value="requested_by_customer">Requested by customer</option>
        <option value="duplicate">Duplicate payment</option>
        <option value="fraudulent">Fraudulent</option>
      </select>
    </div>
    <div>
      <label className="text-xs font-medium text-text-secondary block mb-1">Note (required)</label>
      <textarea value={refundNote} onChange={(e) => setRefundNote(e.target.value)}
                rows={2} className="w-full text-xs ..."
                placeholder="Describe why this refund is being issued (min 10 characters)" />
    </div>
  </div>
  {refundError && <p className="text-xs text-danger mb-3">{refundError}</p>}
  <div className="flex justify-end gap-2">
    <button onClick={() => refundDialogRef.current?.close()}
            className="text-sm text-text-muted hover:text-text-primary px-4 py-2">
      Cancel
    </button>
    <button
      onClick={handleRefundConfirm}
      disabled={refundNote.length < 10 || refunding}
      className="btn-admin-danger text-sm px-4 py-2"
    >
      {refunding ? 'Processing...' : 'Issue refund'}
    </button>
  </div>
</dialog>
```

On successful refund: close dialog; update the invoice row status to "Refunded" in local state;
show a brief success message `"Refunded. Stripe ID: [id]"` above the invoice table for 5 seconds.
On Stripe error: display the exact error message from Stripe inside the dialog (not a generic message).

---

## Done When

**Escalation ingestion:**
- [ ] Sprint-4 escalation handler inserts into `aiva_escalations` on every escalation event
- [ ] Priority derived from reason text: urgent/emergency/legal/complaint -> urgent, payment/refund -> high
- [ ] SLA targets set to +15 min and +4 hours from `created_at`

**Backend:**
- [ ] `GET /api/admin/va/queue` computes `sla_breach` inline; returns counts sub-object
- [ ] Assign route increments VA member `current_load`
- [ ] Resolve route decrements `current_load`; fills `first_response_at` if missing
- [ ] Delete VA member returns 409 if member has open escalations
- [ ] `GET /api/admin/va/sla` returns all fields including `byPriority`, `byVaMember`, `timeline`
- [ ] Revenue summary computes MRR from `monthly_amount_pence` on active + past_due subscriptions
- [ ] At-risk route returns past-due, trial-expiring-in-3-days, and cancelling-at-period-end lists
- [ ] Refund route calls Stripe with correct reason; updates invoice status; writes audit log
- [ ] Refund error returns 422 with exact Stripe error message

**VA Queue - kanban:**
- [ ] Three columns render with counts and SLA breach counts
- [ ] Cards show priority badge (urgent=red, high=amber, no badge for normal)
- [ ] SLA badge shows when < 10m remaining to first response target, or "BREACHED" if overdue
- [ ] SLA-breached cards have red border and tinted background
- [ ] Cards sorted: urgent first, then high, then oldest within same priority
- [ ] Columns scroll independently; page does not scroll
- [ ] Quick assign dropdown shows only available VA members with remaining capacity
- [ ] Selecting an assignee calls PATCH and moves card to In Progress column optimistically
- [ ] SLA overview bar shows correct counts; SLA breached pill is red when count > 0

**Escalation detail panel:**
- [ ] Opens on "View" click; slide-in transition `duration-200`; backdrop closes on click
- [ ] SLA tracker shows correct state for each SLA (Met/Overdue by Xm/Xm remaining)
- [ ] Conversation transcript renders user right/Aiva left; escalation divider is visible
- [ ] Assign dropdown shows available members only; calling PATCH updates panel state
- [ ] "Mark first response" disabled and faded if already marked
- [ ] "Mark resolved" disabled until note >= 10 chars; closes panel and moves card on success
- [ ] Scout signals section only renders if signals are present

**Team tab:**
- [ ] Table renders with load bar, resolved count, avg TTR
- [ ] Available toggle calls PATCH; row dims when unavailable
- [ ] Load bar colored correctly (green/amber/red by threshold)
- [ ] "Add team member" inline form creates a new row; hides on Cancel
- [ ] Remove button shows inline 409 error if member has open escalations

**SLA report tab:**
- [ ] Four KPI cards render; SLA rate colored green/amber/red by threshold
- [ ] Bar chart renders with received/resolved/breached bars; no animation
- [ ] By VA member and by priority tables render with correct values

**Revenue:**
- [ ] Six stat cards render; MRR card shows amber-colored value
- [ ] Line chart renders with three lines (total/new/churned); no animation
- [ ] Tier breakdown table renders with count, MRR, percentage
- [ ] Proportional bar uses correct tier colors
- [ ] At-risk panels show payment failures and trials expiring in 3 days
- [ ] Invoice table renders with status badges and conditionally visible refund button
- [ ] Refund button only on Paid invoices; only visible on row hover
- [ ] Refund modal shows Stripe error message verbatim on failure
- [ ] Refund modal requires note >= 10 chars; button disabled until satisfied
- [ ] On success: invoice row status changes to "Refunded" in place; success message shows

**General:**
- [ ] All Next.js proxy routes require admin session and attach `X-Admin-Token`
- [ ] `recharts` added to package.json if not already present
- [ ] `npx tsc --noEmit --skipLibCheck` passes for all new files
- [ ] No em dashes in any copy, JSX strings, SQL comments, or chart labels
- [ ] No emojis
