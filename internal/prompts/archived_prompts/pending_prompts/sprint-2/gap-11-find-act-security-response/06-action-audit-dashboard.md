# Gap 11 - Prompt 06: Action Audit Trail and Dashboard View

**Gap:** 11 Find-Act Security Response
**Prompt number:** 06 of 06
**Name:** Action Audit Trail and Dashboard View
**Primary agent:** Claude Code
**Estimated hours:** 3-4 h
**Depends on:** Prompts 01, 03, 04 (schema, modal UI, API endpoints)

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Read First

Before writing a single line, read:

1. `console.labyrinthscout.com/public/dashboard/js/widgets/audit-log.js` - existing audit log
   widget for style and rendering pattern to follow
2. `console.labyrinthscout.com/public/dashboard/js/widgets/incident-timeline.js` - another
   example of a timeline/list widget
3. `console.labyrinthscout.com/public/dashboard.html` - dashboard structure, CSS variables,
   tab system, widget layout
4. `console.labyrinthscout.com/src/actions/store.ts` - `listActionExecutions()` from Prompt 01
5. `console.labyrinthscout.com/src/api/actions.ts` - existing routes from Prompt 04

All paths are relative to `/opt/lampp/htdocs/verlox/carina/internal/servers/`.

---

## Context

Every action taken by the system or an operator - whether auto-executed or manually clicked in
the dashboard - is logged to `action_executions`. This prompt adds the API endpoint to fetch
those records and the dashboard widget to display them.

The audit trail serves two purposes:
1. Accountability: who did what, when, and what happened as a result.
2. Debugging: if something was auto-acted incorrectly, the operator can see exactly what the
   system did and when.

The widget should be readable by a non-technical operator. Row format:
`[time] [by whom] [action label] [outcome] [event type]`

Example rows:
```
20:14  system       Switched to restricted mode    success   anomaly_detected (critical)
20:12  system       Flagged for elevated monitoring success   anomaly_detected (warning)
19:55  operator     Dismissed without action       success   alert_test (info)
18:30  malike       Terminate session              success   anomaly_detected (critical)
18:29  system       Arm global kill switch         failure   breach_detected (breach)
```

---

## Step 1: API Endpoint for Executions

Add to `console.labyrinthscout.com/src/api/actions.ts`:

```typescript
// GET /api/actions/executions
// Returns the N most recent action executions, ordered newest first.
// Query params: limit (default 50), event_type (filter), outcome (filter)
actionsRouter.get('/executions', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);
    const eventTypeFilter = typeof req.query.event_type === 'string' ? req.query.event_type : null;
    const outcomeFilter   = typeof req.query.outcome   === 'string' ? req.query.outcome   : null;

    // Fetch from store and filter in memory (small volume - no need for complex SQL filtering)
    let executions = await listActionExecutions(limit * 2); // fetch extra in case filters reduce

    if (eventTypeFilter) {
      // action_executions joins to security_events; the event_type must be added to the store
      // query or we filter by metadata if event_type is stored in metadata
      executions = executions.filter((e) => {
        const meta = e.metadata as Record<string, unknown>;
        return meta.eventType === eventTypeFilter;
      });
    }
    if (outcomeFilter) {
      executions = executions.filter((e) => e.outcome === outcomeFilter);
    }

    res.json({ executions: executions.slice(0, limit), total: executions.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});
```

Note: to make `event_type` available in the execution records, update `logActionExecution()` in
the store to include `eventType` in the `metadata` field when called from the event router and
resolve API. The event type comes from the `SecurityEvent` or `PendingAction` context at call
time.

Update the call sites in `executor.ts` and `api/actions.ts`:
```typescript
metadata: { playbookId: playbook.id, eventType: pending.eventType ?? '' },
```

---

## Step 2: Update Store Query

In `console.labyrinthscout.com/src/actions/store.ts`, update `listActionExecutions()` to also
return the joined event data (event_type, severity) when available:

```typescript
export async function listActionExecutions(limit = 50): Promise<ActionExecution[]> {
  const result = await pool.query<{
    id: string;
    pending_id: string | null;
    event_id: string;
    action_id: string;
    action_label: string;
    executed_by: string;
    execution_type: string;
    outcome: string;
    output: string | null;
    metadata: Record<string, unknown>;
    executed_at: Date;
    // joined from security_events:
    event_type: string | null;
    severity: string | null;
  }>(
    `SELECT ae.*,
            se.event_type,
            se.severity
     FROM action_executions ae
     LEFT JOIN security_events se ON ae.event_id = se.id
     ORDER BY ae.executed_at DESC
     LIMIT $1`,
    [limit],
  );

  return result.rows.map((row) => ({
    id: row.id,
    pendingId: row.pending_id,
    eventId: row.event_id,
    actionId: row.action_id,
    actionLabel: row.action_label,
    executedBy: row.executed_by,
    executionType: row.execution_type as ExecutionType,
    outcome: row.outcome as ExecutionOutcome,
    output: row.output,
    metadata: { ...row.metadata, eventType: row.event_type, eventSeverity: row.severity },
    executedAt: row.executed_at,
  }));
}
```

---

## Step 3: Dashboard Widget

Create `console.labyrinthscout.com/public/dashboard/js/widgets/action-audit.js`:

```javascript
(function () {
  async function load(filters) {
    const params = new URLSearchParams();
    if (filters && filters.outcome) params.set('outcome', filters.outcome);
    if (filters && filters.event_type) params.set('event_type', filters.event_type);
    params.set('limit', '50');

    const res = await fetch('/api/actions/executions?' + params.toString(), {
      headers: window.H ? H() : {},
    });
    if (!res.ok) return;
    const data = await res.json();
    render(data.executions || []);
  }

  function outcomeLabel(outcome) {
    const map = { success: 'OK', failure: 'FAILED', partial: 'PARTIAL', dry_run: 'DRY RUN' };
    return map[outcome] || outcome;
  }

  function outcomeColor(outcome) {
    const map = { success: 'var(--green)', failure: 'var(--red)', partial: 'var(--amber)', dry_run: 'var(--cyan)' };
    return map[outcome] || 'var(--text)';
  }

  function executorLabel(executedBy, executionType) {
    if (executionType === 'auto') return 'system';
    return executedBy || 'operator';
  }

  function timeLabel(isoString) {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function eventLabel(meta) {
    if (!meta) return '';
    const type = meta.eventType || '';
    const sev  = meta.eventSeverity || '';
    if (!type) return '';
    const human = {
      anomaly_detected: 'Unusual activity',
      breach_detected:  'Security breach',
      alert_test:       'Test alert',
      alert_escalated:  'Unacknowledged alert',
      killswitch_armed: 'Kill switch armed',
    };
    const label = human[type] || type.replace(/_/g, ' ');
    return sev ? label + ' (' + sev + ')' : label;
  }

  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function render(items) {
    const el = document.getElementById('action-audit-list');
    if (!el) return;

    if (items.length === 0) {
      el.innerHTML = '<div class="spec-empty">No actions recorded yet</div>';
      return;
    }

    el.innerHTML = items.map(function (item) {
      const meta = item.metadata || {};
      const color = outcomeColor(item.outcome);
      return (
        '<div class="audit-row action-audit-row">' +
          '<span class="audit-time">' + escHtml(timeLabel(item.executedAt)) + '</span>' +
          '<span class="audit-by">' + escHtml(executorLabel(item.executedBy, item.executionType)) + '</span>' +
          '<span class="audit-action">' + escHtml(item.actionLabel) + '</span>' +
          '<span class="audit-outcome" style="color:' + color + '">' + escHtml(outcomeLabel(item.outcome)) + '</span>' +
          '<span class="audit-event">' + escHtml(eventLabel(meta)) + '</span>' +
        '</div>'
      );
    }).join('');
  }

  window.DashboardActionAudit = { load };

  window.addEventListener('load', function () {
    void load(null);

    // Hook up filter controls if they exist
    const outcomeFilter = document.getElementById('action-audit-outcome-filter');
    if (outcomeFilter) {
      outcomeFilter.addEventListener('change', function () {
        void load({ outcome: outcomeFilter.value || null });
      });
    }

    setInterval(function () { void load(null); }, 30000);
  });
})();
```

---

## Step 4: Dashboard HTML for the Audit Widget

In `dashboard.html`, within the actions/response tab or panel, add the audit trail section
below the pending actions widget:

```html
<div class="widget-section">
  <div class="widget-header">
    <h3>Action History</h3>
    <select id="action-audit-outcome-filter" style="font-size:11px;padding:2px 6px;background:var(--navy);border:1px solid var(--border);color:var(--text);border-radius:3px">
      <option value="">All outcomes</option>
      <option value="success">Success only</option>
      <option value="failure">Failures only</option>
      <option value="dry_run">Dry runs</option>
    </select>
  </div>
  <div id="action-audit-list" class="audit-list">
    <div class="spec-empty">Loading...</div>
  </div>
</div>
```

Add CSS for the audit rows inside the existing `<style>` block:

```css
.action-audit-row {
  display: grid;
  grid-template-columns: 45px 80px 1fr 60px 1fr;
  gap: 8px;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
}
.action-audit-row:last-child { border-bottom: none; }
.audit-time  { color: var(--text); font-family: 'JetBrains Mono', monospace; font-size: 11px; }
.audit-by    { color: var(--cyan); font-size: 11px; }
.audit-action { color: var(--bright); }
.audit-outcome { font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 600; }
.audit-event { color: var(--text); font-size: 11px; }
```

Add `<script src="/dashboard/js/widgets/action-audit.js"></script>` to the script section of
`dashboard.html`.

---

## Step 5: Wire Into Global Refresh

If `dashboard.html` has a global auto-refresh or tab-switch refresh function, add:

```javascript
if (window.DashboardActionAudit) void DashboardActionAudit.load();
```

---

## Verification

End-to-end audit trail test:

```bash
# 1. Trigger a test event via the Scout event API
curl -X POST http://localhost:4444/api/events \
  -H 'Content-Type: application/json' \
  -d '{"event_type":"anomaly_detected","severity":"critical","description":"{\"metricName\":\"uniquetoolsused\",\"zScore\":6.04,\"currentValue\":3,\"baselineMean\":0.08}","instance_id":"carina-local","session_id":"test-session-001"}'

# 2. Wait 2 seconds for event routing to run
sleep 2

# 3. Confirm a pending action was created
curl -s http://localhost:4444/api/actions/pending | jq '.count'
# Should be 1

# 4. Get the pending id
PENDING_ID=$(curl -s http://localhost:4444/api/actions/pending | jq -r '.pending[0].id')

# 5. Dismiss it as an operator
curl -X POST http://localhost:4444/api/actions/$PENDING_ID/dismiss \
  -H 'Content-Type: application/json' \
  -d '{"notes":"Verified test: dismissed"}'

# 6. Fetch executions
curl -s http://localhost:4444/api/actions/executions | jq '.executions[0]'
# Should show: action_label: "Dismissed without action", executed_by: "operator", outcome: "success"

# 7. Open the dashboard and check the Action History widget shows the dismissal row.
```
