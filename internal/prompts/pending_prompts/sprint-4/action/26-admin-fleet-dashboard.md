# Sprint 4 - Prompt 26: Fleet Dashboard and Scout Signal Feed

**Sprint:** 4
**Prompt number:** 26
**Primary agent:** Claude Code (backend) + Cursor (frontend)
**Estimated hours:** 8-12 h
**Depends on:** 25-admin-auth-and-customers.md must be merged (admin scaffold and auth must exist)

---

## Post-build (MANDATORY)

When all "Done When" criteria are satisfied:
1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Move to `internal/prompts/archived_prompts/archives_from_pending_prompts/sprint-4/action/`.

---

## Read First

Read every file listed before writing a single line of code:

1. `frontends/client-apps/admin.carinaai.uk/src/app/(admin)/layout.tsx` - the admin shell built in prompt 25; you are adding pages inside it
2. `frontends/client-apps/admin.carinaai.uk/src/lib/admin-api.ts` - helper for calling core from the admin app
3. `frontends/client-apps/admin.carinaai.uk/src/app/(admin)/customers/[id]/page.tsx` - pattern for the slide-in drawer and tabs
4. `backends/servers/core.carinaai.uk/src/aiva/aiva-api.ts` - how workers are stored and queried
5. `backends/servers/core.carinaai.uk/src/admin/admin-router.ts` - add all new routes here
6. `backends/servers/core.carinaai.uk/src/admin/admin-auth.ts` - apply to all new routes
7. `backends/servers/core.carinaai.uk/src/scout/scout-client.ts` - how Scout is called; do not bypass it for signal data

---

## Context

The Fleet page gives the VERLOX team a cross-workspace view of every Aiva. Its primary uses are:
- Spotting Aivas with dangerous escalation rates or Scout signals before the workspace owner notices
- Issuing a kill switch pause on any Aiva immediately, from one place
- Checking attestation coverage as a compliance health metric

The Scout signal feed is a real-time event stream from every Aiva. This prompt makes that stream
visible via a paginated table (historical) and a live SSE toggle. Critical signals trigger a
persistent toast that the admin must explicitly dismiss.

The attestation report is a compliance sub-page linked from the Fleet page. It shows how many
activity records have a confirmed `attestation_tx` vs how many are pending or permanently missing.

---

## Step 1: Scout signal cache (avoid N+1 Scout calls)

Add to `009-aiva-admin.sql` (if not yet run) or a new migration `010-scout-cache.sql`:

```sql
CREATE TABLE IF NOT EXISTS scout_signal_cache (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id   UUID        NOT NULL,
  event_type TEXT        NOT NULL,
  severity   TEXT        NOT NULL,  -- 'info' | 'warning' | 'critical'
  summary    TEXT        NOT NULL,
  metadata   JSONB       NOT NULL DEFAULT '{}',
  scout_tx   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON scout_signal_cache(agent_id, created_at DESC);
CREATE INDEX ON scout_signal_cache(severity, created_at DESC);
CREATE INDEX ON scout_signal_cache(created_at DESC);
```

In `scout-client.ts`, every `scout.reportEvent()` call must also `INSERT INTO scout_signal_cache`
with the same data immediately after. This is a local mirror for fast admin queries.

The `GET /api/admin/fleet` route reads signal counts from `scout_signal_cache`, not Scout's API.
The `GET /api/admin/scout/signals` route also queries `scout_signal_cache` for the paginated feed.

---

## Step 2: Core backend - fleet API routes

Add to `src/admin/admin-router.ts`:

```
GET  /api/admin/fleet                    All Aivas across all workspaces, paginated
GET  /api/admin/fleet/:id                Single Aiva full detail
POST /api/admin/fleet/:id/pause          Kill switch
POST /api/admin/fleet/:id/resume         Resume
GET  /api/admin/scout/signals            Paginated signal feed with filters
GET  /api/admin/scout/signals/stream     SSE live feed
GET  /api/admin/attestation/report       Coverage stats
GET  /api/admin/attestation/unattested   Paginated unattested records
POST /api/admin/attestation/retry/:id    Retry attestation for one activity record
```

All routes apply `admin-middleware`.

---

## Step 3: `GET /api/admin/fleet`

```typescript
// Query params:
//   search: string  (worker name, role, workspace name)
//   status: 'active' | 'paused' | 'dismissed' | 'all'  (default 'all')
//   hasRecentSignals: boolean  (true = only workers with any signal in last 24h)
//   sort: 'escalation_rate_desc' | 'last_active_desc' | 'created_at_desc'  (default: escalation_rate_desc)
//   page: int (default 1), limit: int (default 100)
//
// Join ai_workers + workspaces + aiva_subscriptions
// Aggregate from ai_worker_activity:
//   totalMessages:       COUNT(*) WHERE worker_id = $id
//   messagesLast7d:      COUNT(*) WHERE worker_id = $id AND created_at > NOW() - INTERVAL '7 days'
//   escalationCount:     COUNT(*) WHERE worker_id = $id AND action_type = 'escalated'
//   escalationRate:      escalationCount / totalMessages  (0 if totalMessages = 0)
//   automationsRunCount: COUNT(*) WHERE worker_id = $id AND action_type = 'automation_ran'
//
// Attestation coverage per worker (subquery or WITH):
//   attestationTotal:     COUNT(*) FROM ai_worker_activity WHERE worker_id = $id
//   attestationConfirmed: COUNT(*) WHERE worker_id = $id AND attestation_tx IS NOT NULL
//   attestationCoverage:  attestationConfirmed / attestationTotal  (0.0 to 1.0)
//
// Signal counts from scout_signal_cache WHERE created_at > NOW() - INTERVAL '24 hours':
//   recentSignalCount:     COUNT(*) WHERE agent_id = $id
//   highestRecentSeverity: MAX(severity) using custom order ('critical' > 'warning' > 'info')
//
// Returns: {
//   aivas: Array<{
//     workerId, name, role, status,
//     workspaceId, workspaceName, ownerEmail, planTier,
//     createdAt, lastActiveAt,
//     totalMessages, messagesLast7d,
//     escalationCount, escalationRate,
//     automationsRunCount,
//     scoutRegistered,
//     attestationTotal, attestationConfirmed, attestationCoverage,
//     recentSignalCount, highestRecentSeverity,
//   }>,
//   total, page, limit
// }
```

---

## Step 4: `GET /api/admin/fleet/:id`

```typescript
// Returns all fleet list row fields PLUS:
// {
//   recentActivity:  Array<{ id, actionType, summary, inputSummary, outputSummary,
//                            createdAt, attestationTx }> (last 50),
//   recentSignals:   Array<{ id, eventType, severity, summary, metadata, createdAt }> (last 20),
//   channels:        Array<{ channel, identifier, enabled }>,
//   automations:     Array<{ id, name, scheduleLabel, enabled, lastRunAt, nextRunAt }>,
// }
```

---

## Step 5: Kill switch

**`POST /api/admin/fleet/:id/pause`:**

```typescript
// Body: { reason: string }  (required)
// 1. UPDATE ai_workers SET status = 'paused' WHERE id = $workerId
// 2. Call scout.updateAgentStatus(workerId, 'paused')
// 3. INSERT admin_audit_log:
//    action='kill_switch_pause', target_type='aiva', target_id=workerId,
//    metadata: { reason, workspaceName, workerName, previousStatus }
// Return: { paused: true, workerId, workerName, workspaceName }
```

**`POST /api/admin/fleet/:id/resume`:**

```typescript
// Body: { reason: string }  (required)
// 1. Check aiva_subscriptions.status for the workspace
//    If 'suspended': return 409 { error: 'workspace_suspended',
//      message: 'Resolve workspace billing before resuming this Aiva.' }
// 2. UPDATE ai_workers SET status = 'active' WHERE id = $workerId
// 3. scout.updateAgentStatus(workerId, 'active')
// 4. admin_audit_log: action='kill_switch_resume', metadata: { reason, workerName, workspaceName }
// Return: { resumed: true }
```

---

## Step 6: Scout signal routes

**`GET /api/admin/scout/signals`:**

```typescript
// Query: severity ('info'|'warning'|'critical'|'all'), eventType (string|'all'),
//         agentId (UUID|null), workspaceId (UUID|null),
//         since (ISO timestamp), until (ISO timestamp),
//         page (int), limit (default 50)
//
// Source: scout_signal_cache joined with ai_workers and workspaces
// Returns: {
//   signals: Array<{
//     id, agentId, agentName, workspaceId, workspaceName,
//     eventType, severity, summary, metadata, scoutTx, createdAt
//   }>,
//   total, page, limit
// }
```

**`GET /api/admin/scout/signals/stream` (SSE):**

```typescript
// Headers: Content-Type: text/event-stream, Cache-Control: no-cache, Connection: keep-alive
// On connect: send last 20 signals as initial payload (data: JSON.stringify([...]))
// Then: poll scout_signal_cache every 5 seconds for rows WHERE id > lastSeenId
//   OR use LISTEN/NOTIFY on INSERT trigger if the DB client supports it
// Each new event: data: JSON.stringify({ id, agentId, agentName, workspaceId, workspaceName,
//                                         eventType, severity, summary, createdAt }) + '\n\n'
// Heartbeat: ': heartbeat\n\n' every 30 seconds to keep the connection alive
// On client disconnect: clearInterval/removeListener
```

---

## Step 7: Attestation routes

**`GET /api/admin/attestation/report`:**

```typescript
// Returns: {
//   totalRecords, confirmed, pending, failed, coveragePercent,
//   last24hTotal, last24hConfirmed, last24hCoverage,
//   byWorker: Array<{ workerId, workerName, workspaceName, total, confirmed, coverage }>
//     (top 20 by worst coverage, sorted coverage ASC)
// }
// pending: attestation_tx IS NULL AND created_at > NOW() - INTERVAL '1 hour'
// failed:  attestation_tx IS NULL AND created_at <= NOW() - INTERVAL '1 hour'
```

**`GET /api/admin/attestation/unattested`:**

```typescript
// Query: page, limit (default 50), workerId (UUID|null)
// WHERE attestation_tx IS NULL AND created_at < NOW() - INTERVAL '10 minutes'
// ORDER BY created_at ASC  (oldest first)
// Returns: Array<{ id, workerId, workerName, workspaceId, workspaceName, actionType, createdAt }>
```

**`POST /api/admin/attestation/retry/:id`:**

```typescript
// 1. Fetch activity record by id; verify it exists
// 2. Call attestActivity(activityId)  (the same function used in aiva-api.ts)
// 3. admin_audit_log: action='attestation_retry', target_type='aiva', target_id=workerId,
//    metadata: { activityId, success: boolean }
// Return: { retried: true, activityId, attestationTx: string | null }
```

---

## Step 8: Next.js API proxy routes

In `src/app/api/admin/`:

```
fleet/route.ts                        GET - proxy /api/admin/fleet
fleet/[id]/route.ts                   GET - proxy /api/admin/fleet/:id
fleet/[id]/pause/route.ts             POST - proxy /api/admin/fleet/:id/pause
fleet/[id]/resume/route.ts            POST - proxy /api/admin/fleet/:id/resume
scout/signals/route.ts                GET - proxy /api/admin/scout/signals
scout/signals/stream/route.ts         GET - SSE passthrough (see note below)
attestation/report/route.ts           GET
attestation/unattested/route.ts       GET
attestation/retry/[id]/route.ts       POST
```

All proxy routes: `requireAdminSession(req)` first; attach `X-Admin-Token` header.

**SSE proxy route:**
```typescript
// Do not buffer; pass the ReadableStream directly to NextResponse
export async function GET(req: Request) {
  const session = await requireAdminSession(req);
  const upstream = await fetch(`${process.env.ADMIN_CORE_URL}/api/admin/scout/signals/stream`, {
    headers: { 'X-Admin-Token': session.adminToken },
  });
  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

---

## Step 9: Fleet page UI

`src/app/(admin)/fleet/page.tsx`

**Two tabs across the top of the page: "Aivas" and "Scout Signals".**

Tab bar: same amber underline pattern as customer detail page (amber `border-b-2` on active).

---

### Aivas tab

```
[Search name/role/workspace]  [Status ▾]  [Signals ▾]  [Sort ▾]

┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Aiva              Workspace         Status    Esc 7d   Signals 24h  Attestation  Actions │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│← red  Aria        Acme Corp         ● Active   14 [!]   [crit: 2]    91%                 │
│       Customer svc jo@acme.com                                                           │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│       Friday      Beta Ltd          ● Active    2        0            98%                 │
│       Sales qual  ceo@beta.com                                                           │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│← amb  Max         Gamma Inc         ◌ Paused    7        0            73% [!]             │
│       Booking     ops@gamma.io                                                           │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

**Table structure:**

```tsx
<table className="w-full text-xs">
  <thead>
    <tr className="border-b border-border bg-overlay text-text-muted text-[11px]">
      <th className="text-left px-4 py-2.5 font-medium">Aiva</th>
      <th className="text-left px-4 py-2.5 font-medium">Workspace</th>
      <th className="text-left px-4 py-2.5 font-medium">Status</th>
      <th className="text-left px-4 py-2.5 font-medium">Esc 7d</th>
      <th className="text-left px-4 py-2.5 font-medium">Signals 24h</th>
      <th className="text-left px-4 py-2.5 font-medium">Attestation</th>
      <th className="w-24" />
    </tr>
  </thead>
  <tbody>
    {aivas.map((aiva) => <FleetRow key={aiva.workerId} aiva={aiva} onView={setDrawerAiva} />)}
  </tbody>
</table>
```

**`FleetRow` component:**

```tsx
function FleetRow({ aiva, onView }: { aiva: FleetAiva; onView: (a: FleetAiva) => void }) {
  function rowBorderClass() {
    if (aiva.highestRecentSeverity === 'critical') return 'border-l-2 border-red-500/40 bg-red-500/5';
    if (aiva.escalationRate > 0.2)                return 'border-l-2 border-amber-400/40';
    if (aiva.status === 'paused')                  return 'border-l-2 border-transparent opacity-70';
    return 'border-l-2 border-transparent';
  }
  return (
    <tr className={cn('border-b border-border group', rowBorderClass())}>
      {/* Aiva cell: name + role */}
      <td className="px-4 py-3">
        <p className="font-medium text-text-primary">{aiva.name}</p>
        <p className="text-text-muted text-[11px] truncate max-w-[140px]">{aiva.role}</p>
      </td>

      {/* Workspace cell: name (link) + email */}
      <td className="px-4 py-3">
        <Link href={`/customers/${aiva.workspaceId}`}
              className="text-accent hover:underline font-medium">
          {aiva.workspaceName}
        </Link>
        <p className="text-text-muted text-[11px]">{aiva.ownerEmail}</p>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <AivaStatusDot status={aiva.status} />
      </td>

      {/* Escalations 7d */}
      <td className="px-4 py-3">
        <span className={aiva.escalationRate > 0.2 ? 'text-red-400 font-medium' : 'text-text-muted'}>
          {aiva.escalationCount}
          {aiva.escalationRate > 0.2 && ' [!]'}
        </span>
      </td>

      {/* Signals 24h */}
      <td className="px-4 py-3">
        {aiva.recentSignalCount === 0
          ? <span className="text-text-muted">-</span>
          : aiva.highestRecentSeverity === 'critical'
            ? <span className="text-red-400 font-medium">{aiva.recentSignalCount}</span>
            : <span className="text-amber-400">{aiva.recentSignalCount}</span>
        }
      </td>

      {/* Attestation */}
      <td className="px-4 py-3">
        <AttestationCell coverage={aiva.attestationCoverage} />
      </td>

      {/* Actions - only visible on row hover */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <FleetKillSwitchButton aiva={aiva} />
          <button
            type="button"
            onClick={() => onView(aiva)}
            className="text-[11px] text-accent hover:underline"
          >
            View
          </button>
        </div>
      </td>
    </tr>
  );
}
```

`AttestationCell`:
```tsx
function AttestationCell({ coverage }: { coverage: number }) {
  const pct = Math.round(coverage * 100);
  const colorClass = pct >= 95 ? 'text-green-400' : pct >= 80 ? 'text-amber-400' : 'text-red-400';
  return <span className={colorClass}>{pct}%</span>;
}
```

**`FleetKillSwitchButton`:**

Clicking opens a `<dialog>` confirmation modal:
```tsx
<dialog ref={dialogRef} className="rounded-xl border border-border bg-elevated p-6 w-full max-w-md backdrop:bg-black/50">
  <h2 className="text-base font-semibold text-text-primary mb-1">Pause this Aiva?</h2>
  <p className="text-sm text-text-secondary mb-4">
    You are pausing <strong>{aiva.name}</strong> ({aiva.role}) for workspace{' '}
    <strong>{aiva.workspaceName}</strong>. This immediately stops all active conversations.
    The workspace owner will see a paused status in their portal.
  </p>
  <div className="mb-4">
    <label className="text-xs font-medium text-text-secondary block mb-1">Reason (required)</label>
    <input value={reason} onChange={(e) => setReason(e.target.value)}
           className="w-full ..."
           placeholder="Why are you pausing this Aiva?" />
  </div>
  {error && <p className="text-xs text-danger mb-3">{error}</p>}
  <div className="flex justify-end gap-2">
    <button onClick={() => dialogRef.current?.close()} className="text-sm text-text-muted hover:text-text-primary px-4 py-2">
      Cancel
    </button>
    <button onClick={handleConfirm} disabled={!reason || loading}
            className="btn-admin-danger text-sm px-4 py-2">
      {loading ? 'Pausing...' : 'Pause Aiva'}
    </button>
  </div>
</dialog>
```

On confirm: `POST /api/admin/fleet/[id]/pause` with `{ reason }`. On success: update the row status
to "paused" (optimistic update in parent state) and show a brief success flash at the top of the page.
On error (e.g. 409 workspace_suspended for resume): show the error message inside the dialog.

Resume button shows the same dialog but with "Resume Aiva?" heading and no reason field requirement
for resume (though still recommended to log one).

---

### Aiva detail drawer

State: `const [drawerAiva, setDrawerAiva] = useState<FleetAiva | null>(null)`. Fetch full detail
on open via `GET /api/admin/fleet/[id]`.

```
fixed right-0 top-10 bottom-0 w-[480px] bg-elevated border-l border-border z-50 flex flex-col
```

Backdrop: `fixed inset-0 bg-black/40 z-40` (click closes the drawer).

Enter/exit: `translate-x-full` to `translate-x-0` CSS transition `duration-200 ease-out`.

```tsx
<div className={cn(
  'fixed right-0 top-10 bottom-0 w-[480px] bg-elevated border-l border-border z-50',
  'flex flex-col transition-transform duration-200',
  drawerAiva ? 'translate-x-0' : 'translate-x-full',
)}>
  {/* Header */}
  <div className="flex items-start justify-between p-4 border-b border-border shrink-0">
    <div>
      <div className="flex items-center gap-2 mb-0.5">
        <AivaStatusDot status={detail?.status} />
        <h2 className="text-base font-semibold text-text-primary">{drawerAiva.name}</h2>
      </div>
      <p className="text-xs text-text-muted">{drawerAiva.role}</p>
      <Link href={`/customers/${drawerAiva.workspaceId}`}
            className="text-xs text-accent hover:underline">
        {drawerAiva.workspaceName}
      </Link>
    </div>
    <button onClick={() => setDrawerAiva(null)}
            className="text-text-muted hover:text-text-primary">
      <X className="h-4 w-4" />
    </button>
  </div>

  {/* Stat row */}
  <div className="grid grid-cols-4 gap-3 p-4 border-b border-border shrink-0 text-center">
    <div>
      <p className="text-lg font-semibold text-text-primary">{detail?.totalMessages ?? '-'}</p>
      <p className="text-[10px] text-text-muted">Total msgs</p>
    </div>
    <div>
      <p className="text-lg font-semibold text-text-primary">{detail?.escalationCount ?? '-'}</p>
      <p className="text-[10px] text-text-muted">Escalations</p>
    </div>
    <div>
      <p className={cn('text-lg font-semibold', attestColor(detail?.attestationCoverage))}>
        {detail ? Math.round(detail.attestationCoverage * 100) + '%' : '-'}
      </p>
      <p className="text-[10px] text-text-muted">Attestation</p>
    </div>
    <div>
      <p className="text-lg font-semibold text-text-primary">{detail?.recentSignalCount ?? '-'}</p>
      <p className="text-[10px] text-text-muted">Signals 24h</p>
    </div>
  </div>

  {/* Kill switch */}
  <div className="px-4 py-3 border-b border-border shrink-0">
    <FleetKillSwitchButton aiva={drawerAiva} fullWidth />
  </div>

  {/* Scrollable body */}
  <div className="flex-1 overflow-y-auto p-4 space-y-6">
    {/* Recent activity */}
    <DrawerSection title="Recent activity (last 20)">
      <div className="divide-y divide-border">
        {detail?.recentActivity.map((item) => (
          <div key={item.id} className="flex items-center gap-2 py-2">
            <ActionBadge type={item.actionType} />
            <span className="text-[11px] text-text-secondary flex-1 truncate">{item.summary}</span>
            <span className="text-[11px] text-text-muted">{timeAgo(item.createdAt)}</span>
            {item.attestationTx
              ? <span className="text-[11px] text-green-400">On-chain</span>
              : <span className="text-[11px] text-text-muted">Pending</span>
            }
          </div>
        ))}
      </div>
    </DrawerSection>

    {/* Scout signals */}
    <DrawerSection title="Scout signals (last 10)">
      {detail?.recentSignals.length === 0
        ? <p className="text-[11px] text-text-muted">No signals.</p>
        : detail?.recentSignals.map((sig) => (
          <div key={sig.id} className={cn(
            'flex items-center gap-2 py-1.5 px-2 rounded text-[11px]',
            sig.severity === 'critical' && 'bg-red-500/10',
            sig.severity === 'warning'  && 'bg-amber-500/10',
          )}>
            <SeverityBadge severity={sig.severity} />
            <span className="text-text-muted font-mono">{sig.eventType}</span>
            <span className="text-text-secondary flex-1 truncate">{sig.summary}</span>
            <span className="text-text-muted">{timeAgo(sig.createdAt)}</span>
          </div>
        ))
      }
    </DrawerSection>

    {/* Channels */}
    <DrawerSection title="Channels">
      {detail?.channels.map((ch) => (
        <div key={ch.channel} className="flex items-center gap-2 py-1 text-[11px]">
          <ChannelIcon channel={ch.channel} className="h-3.5 w-3.5 text-text-muted" />
          <span className="text-text-secondary">{ch.channel}</span>
          <span className="text-text-muted flex-1">{maskIdentifier(ch.identifier, ch.channel)}</span>
          <span className={ch.enabled ? 'text-green-400' : 'text-text-muted'}>
            {ch.enabled ? 'active' : 'paused'}
          </span>
        </div>
      ))}
    </DrawerSection>

    {/* Automations */}
    <DrawerSection title="Automations">
      {detail?.automations.length === 0
        ? <p className="text-[11px] text-text-muted">No automations.</p>
        : detail?.automations.map((auto) => (
          <div key={auto.id} className="flex items-center gap-2 py-1 text-[11px]">
            <span className="text-text-primary flex-1">{auto.name}</span>
            <span className="text-[10px] bg-accent-dim text-accent px-1.5 py-0.5 rounded">
              {auto.scheduleLabel}
            </span>
            <span className={auto.enabled ? 'text-green-400' : 'text-text-muted'}>
              {auto.enabled ? 'on' : 'off'}
            </span>
          </div>
        ))
      }
    </DrawerSection>
  </div>

  {/* Footer */}
  <div className="p-4 border-t border-border shrink-0">
    <Link href={`/customers/${drawerAiva?.workspaceId}`}
          className="text-xs text-accent hover:underline">
      Open workspace customer page
    </Link>
  </div>
</div>
```

`DrawerSection`:
```tsx
function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2">
        {title}
      </p>
      {children}
    </div>
  );
}
```

---

### Scout Signals tab

```tsx
<div>
  {/* Filter row */}
  <div className="flex items-center gap-3 mb-4 flex-wrap">
    <select value={severityFilter}>
      <option value="all">All severities</option>
      <option value="critical">Critical</option>
      <option value="warning">Warning</option>
      <option value="info">Info</option>
    </select>
    <select value={eventTypeFilter}>
      <option value="all">All event types</option>
      <option value="escalation_burst">escalation_burst</option>
      <option value="high_escalation_rate">high_escalation_rate</option>
      <option value="volume_spike">volume_spike</option>
      <option value="unauthorized_tool_attempt">unauthorized_tool_attempt</option>
      <option value="tool_failure_loop">tool_failure_loop</option>
    </select>
    <input placeholder="Aiva name..." className="..." value={aivaSearch} onChange={...} />
    <input placeholder="Workspace..." className="..." value={workspaceSearch} onChange={...} />
    <DateRangePicker value={dateRange} onChange={setDateRange} />
    {/* Live toggle - right-aligned */}
    <div className="ml-auto flex items-center gap-2">
      <LiveIndicator connected={liveConnected} />
      <button
        type="button"
        role="switch"
        aria-checked={liveEnabled}
        onClick={() => setLiveEnabled(!liveEnabled)}
        className={cn(
          'relative inline-flex h-5 w-9 rounded-full transition-colors',
          liveEnabled ? 'bg-green-500/60' : 'bg-overlay',
        )}
      >
        <span className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
          liveEnabled ? 'translate-x-4' : 'translate-x-0.5',
        )} />
      </button>
      <span className="text-xs text-text-muted">Live</span>
    </div>
  </div>

  {/* Signal table */}
  <div className="rounded-lg border border-border overflow-hidden">
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-border bg-overlay text-[11px] text-text-muted">
          <th className="text-left px-4 py-2.5 font-medium">Time</th>
          <th className="text-left px-4 py-2.5 font-medium">Severity</th>
          <th className="text-left px-4 py-2.5 font-medium">Event type</th>
          <th className="text-left px-4 py-2.5 font-medium">Aiva</th>
          <th className="text-left px-4 py-2.5 font-medium">Workspace</th>
          <th className="text-left px-4 py-2.5 font-medium">Summary</th>
          <th className="w-8" />
        </tr>
      </thead>
      <tbody>
        {signals.map((sig) => <SignalRow key={sig.id} sig={sig} onAivaClick={setDrawerAiva} />)}
      </tbody>
    </table>
  </div>

  {/* Load more */}
  {hasMore && (
    <button onClick={loadMore} className="mt-3 text-xs text-accent hover:underline">
      Load more
    </button>
  )}
</div>
```

**`SignalRow`:**

```tsx
function SignalRow({ sig, onAivaClick }: { sig: Signal; onAivaClick: ... }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <tr className={cn(
        'border-b border-border group',
        sig.severity === 'critical' && 'bg-red-500/5 border-l-2 border-red-500/40',
        sig.severity === 'warning'  && 'bg-amber-500/5 border-l-2 border-amber-400/30',
        sig.severity === 'info'     && 'border-l-2 border-transparent',
      )}>
        <td className="px-4 py-2.5 text-text-muted whitespace-nowrap">{formatTimestamp(sig.createdAt)}</td>
        <td className="px-4 py-2.5"><SeverityBadge severity={sig.severity} /></td>
        <td className="px-4 py-2.5 font-mono text-text-muted">{sig.eventType}</td>
        <td className="px-4 py-2.5">
          <button onClick={() => onAivaClick(sig)} className="text-accent hover:underline">
            {sig.agentName}
          </button>
        </td>
        <td className="px-4 py-2.5">
          <Link href={`/customers/${sig.workspaceId}`} className="text-text-secondary hover:text-accent">
            {sig.workspaceName}
          </Link>
        </td>
        <td className="px-4 py-2.5 text-text-secondary max-w-[200px] truncate">{sig.summary}</td>
        <td className="px-4 py-2.5 text-center">
          <button onClick={() => setExpanded(!expanded)}
                  className="text-text-muted hover:text-text-primary opacity-0 group-hover:opacity-100">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-border">
          <td colSpan={7} className="px-4 py-3 bg-overlay">
            <pre className="text-[11px] font-mono text-text-secondary whitespace-pre-wrap">
              {JSON.stringify(sig.metadata, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}
```

**`LiveIndicator`:**

```tsx
function LiveIndicator({ connected }: { connected: boolean | 'reconnecting' }) {
  if (!connected)      return null;
  if (connected === 'reconnecting')
    return <span className="text-[11px] text-amber-400 flex items-center gap-1">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
      Reconnecting...
    </span>;
  return <span className="text-[11px] text-green-400 flex items-center gap-1">
    <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
    Live
  </span>;
}
```

**Live SSE connection logic (in the Scout Signals tab client component):**

```typescript
useEffect(() => {
  if (!liveEnabled) return;
  let es: EventSource;
  let retryTimeout: ReturnType<typeof setTimeout>;

  function connect() {
    setLiveConnected(true);
    es = new EventSource('/api/admin/scout/signals/stream');
    es.onmessage = (e) => {
      const signal: Signal = JSON.parse(e.data);
      setSignals((prev) => [signal, ...prev]);  // prepend to table
      if (signal.severity === 'critical') {
        setToasts((prev) => [...prev, signal]);  // persistent toast
      }
    };
    es.onerror = () => {
      setLiveConnected('reconnecting');
      es.close();
      retryTimeout = setTimeout(connect, 3000);  // back off 3s
    };
  }

  connect();
  return () => { es?.close(); clearTimeout(retryTimeout); setLiveConnected(false); };
}, [liveEnabled]);
```

New rows arriving via SSE should have a brief `bg-amber-500/10` highlight that fades after 2 seconds:
```tsx
// Add a `new` flag to the signal row state; fade it out with a useEffect timeout
className={cn(rowBase, sig.isNew && 'bg-amber-500/10 transition-colors')}
```

**Critical signal toast stack** (`fixed bottom-4 right-4 z-[60] flex flex-col gap-2`):

```tsx
{criticalToasts.map((toast) => (
  <div
    key={toast.id}
    className="w-72 rounded-lg border border-red-500/40 bg-elevated shadow-lg p-3
               border-t-2 border-t-red-500"
  >
    <div className="flex items-start justify-between gap-2 mb-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400">
        Critical - {toast.eventType}
      </span>
      <button onClick={() => dismissToast(toast.id)}
              className="text-text-muted hover:text-text-primary shrink-0">
        <X className="h-3 w-3" />
      </button>
    </div>
    <p className="text-xs font-medium text-text-primary mb-0.5">
      {toast.agentName} in {toast.workspaceName}
    </p>
    <p className="text-[11px] text-text-secondary mb-2 line-clamp-2">{toast.summary}</p>
    <button
      onClick={() => { setDrawerAivaId(toast.agentId); dismissToast(toast.id); }}
      className="text-[11px] text-accent hover:underline"
    >
      View
    </button>
  </div>
))}
```

Toasts persist until explicitly dismissed with the X button. Multiple toasts stack vertically.
Never auto-dismiss.

---

## Step 10: Attestation report page

`src/app/(admin)/fleet/attestation/page.tsx`

Linked from the Fleet page: `Attestation report ->` link at the top-right of the Fleet page header,
above the tab bar.

```tsx
<div className="mx-auto max-w-6xl px-8 py-6">
  <div className="flex items-center justify-between mb-6">
    <div>
      <h1 className="text-2xl font-semibold">Attestation coverage</h1>
      <p className="text-sm text-text-muted mt-0.5">
        On-chain verification of all Aiva activity records
      </p>
    </div>
    <Link href="/fleet" className="text-xs text-accent hover:underline flex items-center gap-1">
      <ChevronLeft className="h-3 w-3" /> Back to Fleet
    </Link>
  </div>

  {/* Summary cards */}
  <div className="grid grid-cols-5 gap-3 mb-6">
    <StatCard label="Total records"     value={report.totalRecords.toLocaleString()} />
    <StatCard label="Confirmed"         value={report.confirmed.toLocaleString()} />
    <StatCard label="Pending"           value={report.pending.toLocaleString()} />
    <StatCard label="Failed"            value={report.failed.toLocaleString()} colorClass="text-red-400" />
    <CoverageCard pct={report.coveragePercent} />
  </div>

  {/* Last 24h sub-stats */}
  <div className="flex items-center gap-6 mb-8 text-xs text-text-muted">
    <span>Last 24h:</span>
    <span>{report.last24hTotal.toLocaleString()} records</span>
    <span>{report.last24hConfirmed.toLocaleString()} confirmed</span>
    <span className={attestColor(report.last24hCoverage / 100)}>
      {report.last24hCoverage.toFixed(1)}% coverage
    </span>
  </div>

  {/* Worst coverage table */}
  <div className="mb-8">
    <h2 className="text-sm font-medium text-text-primary mb-3">
      Aivas with lowest attestation coverage
    </h2>
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-overlay text-[11px] text-text-muted">
            <th className="text-left px-4 py-2.5 font-medium">Aiva</th>
            <th className="text-left px-4 py-2.5 font-medium">Workspace</th>
            <th className="text-left px-4 py-2.5 font-medium">Total</th>
            <th className="text-left px-4 py-2.5 font-medium">Confirmed</th>
            <th className="text-left px-4 py-2.5 font-medium">Coverage</th>
            <th className="text-left px-4 py-2.5 font-medium">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {report.byWorker.map((row) => (
            <tr key={row.workerId}>
              <td className="px-4 py-2.5 font-medium text-text-primary">{row.workerName}</td>
              <td className="px-4 py-2.5">
                <Link href={`/customers/${row.workspaceId}`} className="text-accent hover:underline">
                  {row.workspaceName}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-text-muted">{row.total.toLocaleString()}</td>
              <td className="px-4 py-2.5 text-text-muted">{row.confirmed.toLocaleString()}</td>
              <td className="px-4 py-2.5">
                <AttestationCell coverage={row.coverage} />
              </td>
              <td className="px-4 py-2.5">
                <RetryAllButton workerId={row.workerId} failedCount={row.total - row.confirmed} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>

  {/* Unattested records */}
  <div>
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-medium text-text-primary">All unattested records (oldest first)</h2>
      <RetryAllOnPageButton activityIds={unattestedPage.map((r) => r.id)} />
    </div>
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-overlay text-[11px] text-text-muted">
            <th className="text-left px-4 py-2.5 font-medium">Activity ID</th>
            <th className="text-left px-4 py-2.5 font-medium">Aiva</th>
            <th className="text-left px-4 py-2.5 font-medium">Workspace</th>
            <th className="text-left px-4 py-2.5 font-medium">Action type</th>
            <th className="text-left px-4 py-2.5 font-medium">Created</th>
            <th className="w-16" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {unattestedPage.map((rec) => (
            <UnattestedRow key={rec.id} rec={rec} onRetried={removeRow} />
          ))}
        </tbody>
      </table>
    </div>
    {unattestedHasMore && (
      <button onClick={loadMoreUnattested} className="mt-3 text-xs text-accent hover:underline">
        Load more
      </button>
    )}
  </div>
</div>
```

**`CoverageCard`:**
```tsx
function CoverageCard({ pct }: { pct: number }) {
  const bgClass = pct >= 95 ? 'bg-green-500/10' : pct >= 80 ? 'bg-amber-500/10' : 'bg-red-500/10';
  const textClass = pct >= 95 ? 'text-green-400' : pct >= 80 ? 'text-amber-400' : 'text-red-400';
  return (
    <div className={`rounded-lg border border-border p-4 ${bgClass}`}>
      <p className={`text-4xl font-semibold ${textClass}`}>{pct.toFixed(1)}%</p>
      <p className="text-xs text-text-muted mt-0.5">Coverage</p>
    </div>
  );
}
```

**`RetryAllButton`** (per worker row):

Shows a progress state while retrying:
```tsx
// Fetch all unattested records for this workerId, then POST to /api/admin/attestation/retry/[id]
// for each one in sequence (not parallel, to avoid overwhelming the attestation service)
// Show: "Retrying 2,256... (1,847 done)" with a mini progress bar
// On complete: show "Done. 2,201 confirmed, 55 still pending"
```

**`UnattestedRow`:**

"Retry" button calls `POST /api/admin/attestation/retry/[id]`. On success: fade the row out
(`opacity-0 transition-opacity duration-300`) then call `onRetried(rec.id)` to remove from state.

**`RetryAllOnPageButton`:**

Retry all visible records in sequence. Show `"Retrying 50 records... (23 done)"` banner above
the table while running. On complete: show how many succeeded.

---

## Done When

**Backend:**
- [ ] `scout_signal_cache` table created; every `scout.reportEvent()` inserts a local row
- [ ] `GET /api/admin/fleet` returns all specified fields; attestation coverage computed via SQL
- [ ] `GET /api/admin/fleet/:id` returns activity, signals, channels, automations
- [ ] Kill switch pause: updates DB, calls scout, writes audit log, returns correct body
- [ ] Kill switch resume: checks workspace subscription; returns 409 if suspended
- [ ] `GET /api/admin/scout/signals` queries `scout_signal_cache`; supports all filters
- [ ] SSE endpoint streams new signals; sends heartbeat every 30s; handles client disconnect
- [ ] Attestation report returns all fields including `byWorker` sorted by coverage ASC
- [ ] Unattested records route uses 10-minute grace period; orders oldest first
- [ ] Retry route calls `attestActivity` and writes audit log

**Fleet page - Aivas tab:**
- [ ] Table renders with all columns; search, status filter, signals filter, sort all work
- [ ] Rows with critical signals have red left border and tinted background
- [ ] Rows with high escalation rate (> 0.2) have amber left border
- [ ] Paused rows have reduced opacity
- [ ] Actions column (Pause/View) is hidden by default, visible on row hover
- [ ] Kill switch modal requires a reason; "Pause Aiva" button disabled without it
- [ ] On successful pause: row status updates in place; success flash at page top
- [ ] Resume: 409 workspace_suspended error displayed inside modal

**Aiva detail drawer:**
- [ ] Opens from "View" click; fetches full detail on open
- [ ] Slide-in transition `duration-200`; backdrop closes on click
- [ ] Stat row shows total messages, escalations, attestation %, signals 24h
- [ ] Kill switch button functional in drawer (same modal flow)
- [ ] Activity feed renders with action badges and attestation state
- [ ] Signals section: critical rows highlighted
- [ ] Channels list shows masked identifiers and active/paused state
- [ ] Automations list shows name, schedule, enabled state

**Scout Signals tab:**
- [ ] All filters work (severity, event type, Aiva name, workspace, date range)
- [ ] Table rows color-coded by severity (red/amber/transparent left border)
- [ ] Detail row expands to show metadata JSON
- [ ] Live toggle connects to SSE endpoint; new signals prepend to table with brief amber highlight
- [ ] Live indicator shows pulsing green dot when connected; amber "Reconnecting..." on error
- [ ] Auto-reconnects after 3s on disconnect
- [ ] Critical signal toast appears in bottom-right; stacks; never auto-dismissed; X dismisses

**Attestation report:**
- [ ] Five stat cards render; Coverage % card background colored by threshold
- [ ] Last 24h sub-stats render below cards
- [ ] Worst-coverage table shows top 20 Aivas by lowest coverage; sorted ascending
- [ ] "Retry all failed" per row shows progress state; updates count on complete
- [ ] Unattested records table paginates at 50; "Load more" works
- [ ] Per-row "Retry" fades and removes the row on success
- [ ] "Retry all on page" shows progress banner

**General:**
- [ ] All Next.js proxy routes require admin session and attach `X-Admin-Token`
- [ ] SSE proxy route streams without buffering
- [ ] `npx tsc --noEmit --skipLibCheck` passes
- [ ] No em dashes in any copy, JSX strings, or SQL comments
- [ ] No emojis
