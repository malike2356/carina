# Gap 11 - Prompt 03: Human-Action Modal UI

**Gap:** 11 Find-Act Security Response
**Prompt number:** 03 of 06
**Name:** Human-Action Modal UI (Dashboard)
**Primary agent:** Claude Code
**Estimated hours:** 5-7 h
**Depends on:** Prompt 01 (tables and types), Prompt 04 (Resolve API endpoints)

---

## Read First

Before writing a single line, read:

1. `console.labyrinthscout.com/public/dashboard.html` - the full dashboard HTML structure, CSS
   variables, and widget layout (important: understand the tab system and widget insertion points)
2. `console.labyrinthscout.com/public/dashboard/js/widgets/incident-timeline.js` - example widget
   pattern: IIFE, fetch, render, `window.DashboardXxx` export, `window.addEventListener('load')`
3. `console.labyrinthscout.com/public/dashboard/js/widgets/kill-switch.js` - example of a modal
   or interactive widget with buttons and confirmation flows
4. `console.labyrinthscout.com/public/dashboard/js/widgets/action-queue.js` - existing action
   queue widget (understand what it already does before adding anything)
5. `console.labyrinthscout.com/src/actions/types.ts` - `PendingAction`, `PlaybookAction`

All paths above are relative to `/opt/lampp/htdocs/verlox/carina/internal/servers/`.

---

## Context

This prompt adds the operator-facing UI for the Find-Act system. When a human-action pending
action exists, the dashboard must show it prominently. Clicking it opens a modal that gives the
operator everything they need to understand and resolve the event - all in plain English, with
no raw JSON, no UUIDs, and no technical jargon exposed by default.

The dashboard is vanilla JS with no framework. All widgets follow the IIFE pattern with a
`window.DashboardXxx` export. CSS uses the existing CSS variables from `dashboard.html`.
Match the visual style exactly - do not introduce new color or layout conventions.

---

## Step 1: Pending Actions Badge

The dashboard should show a visible indicator when pending actions exist. Add a badge count to
the navigation or the top status bar that shows the number of unresolved pending actions.

In `dashboard.html`, find the top navigation or status bar. Add an element:

```html
<span id="pending-action-count"
      class="badge-count"
      style="display:none"
      title="Pending actions require your review">0</span>
```

Style it with the existing `--red` or `--amber` CSS variable (use amber for 1 pending, red for
3+). The badge must update every 30 seconds (same polling cadence as other widgets).

---

## Step 2: Pending Actions Widget

Create `console.labyrinthscout.com/public/dashboard/js/widgets/pending-actions.js`.

This widget displays a list of unresolved pending actions. Each item shows:
- Severity level (coloured label using existing `--green`, `--amber`, `--red` variables)
- Plain-English event title (from the playbook title, not the raw event_type)
- Time since the event (e.g. "3 minutes ago", "1 hour ago")
- A "Review" button that opens the resolve modal

```javascript
(function () {
  let currentPending = [];

  async function load() {
    const res = await fetch('/api/actions/pending', { headers: window.H ? H() : {} });
    if (!res.ok) return;
    const data = await res.json();
    currentPending = data.pending || [];
    render(currentPending);
    updateBadge(currentPending.length);
  }

  function updateBadge(count) {
    const badge = document.getElementById('pending-action-count');
    if (!badge) return;
    badge.textContent = String(count);
    badge.style.display = count > 0 ? 'inline-block' : 'none';
    badge.style.background = count >= 3 ? 'var(--red)' : 'var(--amber)';
  }

  function timeAgo(isoString) {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' minute' + (mins === 1 ? '' : 's') + ' ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + ' hour' + (hrs === 1 ? '' : 's') + ' ago';
    return Math.floor(hrs / 24) + ' days ago';
  }

  function severityClass(severity) {
    return { info: 'cyan', warning: 'amber', critical: 'red', breach: 'red' }[severity] || 'cyan';
  }

  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function render(items) {
    const el = document.getElementById('pending-actions-list');
    if (!el) return;

    if (items.length === 0) {
      el.innerHTML = '<div class="spec-empty">No pending actions - all clear</div>';
      return;
    }

    el.innerHTML = items.map(function (item) {
      const cls = severityClass(item.eventSeverity);
      return (
        '<div class="pending-action-row" data-id="' + escHtml(item.id) + '">' +
          '<span class="sev-label ' + cls + '">' + escHtml((item.eventSeverity || 'info').toUpperCase()) + '</span>' +
          '<div class="pending-action-body">' +
            '<strong>' + escHtml(item.playbook ? item.playbook.title : item.playbookId) + '</strong>' +
            '<span class="pending-time">' + timeAgo(item.createdAt) + '</span>' +
          '</div>' +
          '<button class="btn-resolve" onclick="DashboardPendingActions.openModal(\'' + escHtml(item.id) + '\')">' +
            'Review' +
          '</button>' +
        '</div>'
      );
    }).join('');
  }

  function openModal(pendingId) {
    const item = currentPending.find(function (p) { return p.id === pendingId; });
    if (!item) return;
    renderModal(item);
    document.getElementById('resolve-modal-overlay').style.display = 'flex';
  }

  function closeModal() {
    document.getElementById('resolve-modal-overlay').style.display = 'none';
  }

  // Render the resolve modal for a given pending action
  function renderModal(item) {
    const modal = document.getElementById('resolve-modal');
    if (!modal) return;
    const playbook = item.playbook;
    if (!playbook) return;

    const actions = (playbook.actions || []).map(function (action) {
      const btnClass = action.destructive ? 'btn-action destructive' : 'btn-action';
      const stepsHtml = action.steps
        ? '<details class="action-steps"><summary>Show manual steps</summary><ol>' +
          action.steps.map(function (s) { return '<li>' + escHtml(s) + '</li>'; }).join('') +
          '</ol></details>'
        : '';
      const scriptHtml = action.script
        ? '<details class="action-steps"><summary>Show command</summary><pre class="action-script">' + escHtml(action.script) + '</pre></details>'
        : '';
      return (
        '<div class="action-option">' +
          '<div class="action-option-header">' +
            '<strong>' + escHtml(action.label) + '</strong>' +
            (action.reversible ? '<span class="tag reversible">Reversible</span>' : '<span class="tag permanent">Permanent</span>') +
          '</div>' +
          '<p class="action-desc">' + escHtml(action.description) + '</p>' +
          stepsHtml + scriptHtml +
          (action.type === 'button'
            ? '<button class="' + btnClass + '" onclick="DashboardPendingActions.executeAction(\'' +
              escHtml(item.id) + '\',\'' + escHtml(action.id) + '\',\'' + escHtml(action.label) + '\',' +
              (action.requiresConfirmation ? 'true' : 'false') + ')">' +
              escHtml(action.label) + '</button>'
            : '')
        + '</div>'
      );
    }).join('');

    modal.innerHTML =
      '<div class="modal-header">' +
        '<h2>' + escHtml(playbook.title) + '</h2>' +
        '<button class="modal-close" onclick="DashboardPendingActions.closeModal()">Close</button>' +
      '</div>' +
      '<div class="modal-section">' +
        '<h3>What happened</h3>' +
        '<p>' + escHtml(playbook.summary) + '</p>' +
      '</div>' +
      '<div class="modal-section risk">' +
        '<h3>What is at risk</h3>' +
        '<p>' + escHtml(playbook.riskNote) + '</p>' +
      '</div>' +
      '<div class="modal-section">' +
        '<h3>Available actions</h3>' +
        '<div class="actions-list">' + actions + '</div>' +
      '</div>' +
      '<div class="modal-section dismiss">' +
        '<button class="btn-dismiss" onclick="DashboardPendingActions.dismiss(\'' + escHtml(item.id) + '\')">' +
          'Dismiss without action' +
        '</button>' +
        '<span class="dismiss-note">Only dismiss if you have reviewed this and are confident no action is needed.</span>' +
      '</div>';
  }

  async function executeAction(pendingId, actionId, actionLabel, requiresConfirmation) {
    if (requiresConfirmation) {
      const confirmed = window.confirm(
        'Execute "' + actionLabel + '"? ' +
        'This action will be logged and cannot be undone if marked permanent.'
      );
      if (!confirmed) return;
    }

    const res = await fetch('/api/actions/' + encodeURIComponent(pendingId) + '/execute', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, window.H ? H() : {}),
      body: JSON.stringify({ action_id: actionId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(function () { return {}; });
      alert('Action failed: ' + (err.error || 'Unknown error'));
      return;
    }

    const result = await res.json();
    closeModal();
    alert(result.message || 'Action executed successfully.');
    void load();
  }

  async function dismiss(pendingId) {
    const confirmed = window.confirm(
      'Dismiss this alert without taking action? It will be marked as reviewed.'
    );
    if (!confirmed) return;

    const res = await fetch('/api/actions/' + encodeURIComponent(pendingId) + '/dismiss', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, window.H ? H() : {}),
      body: JSON.stringify({ notes: 'Dismissed by operator via dashboard' }),
    });

    if (!res.ok) {
      alert('Could not dismiss: ' + res.statusText);
      return;
    }

    closeModal();
    void load();
  }

  window.DashboardPendingActions = { load, openModal, closeModal, executeAction, dismiss };

  window.addEventListener('load', function () {
    void load();
    setInterval(load, 30000);
  });
})();
```

---

## Step 3: Modal HTML and CSS

In `dashboard.html`, add the modal overlay. Place it at the bottom of `<body>` before the
closing tag:

```html
<!-- Resolve modal overlay -->
<div id="resolve-modal-overlay"
     style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);
            z-index:9000;align-items:center;justify-content:center;padding:20px">
  <div id="resolve-modal"
       style="background:var(--lift);border:1px solid var(--border);border-radius:8px;
              max-width:600px;width:100%;max-height:85vh;overflow-y:auto;padding:24px">
    <!-- Populated by DashboardPendingActions.renderModal() -->
  </div>
</div>
```

Add CSS for the modal components. Add inside the existing `<style>` block in `dashboard.html`:

```css
/* Pending actions widget */
.pending-action-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}
.pending-action-row:last-child { border-bottom: none; }
.pending-action-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.pending-time { font-size: 11px; color: var(--text); }
.sev-label {
  font-size: 10px;
  font-family: 'JetBrains Mono', monospace;
  padding: 2px 6px;
  border-radius: 3px;
  font-weight: 600;
  flex-shrink: 0;
}
.sev-label.red    { background: rgba(255,34,68,.15); color: var(--red); border: 1px solid var(--red); }
.sev-label.amber  { background: rgba(212,175,55,.12); color: var(--amber); border: 1px solid var(--amber); }
.sev-label.cyan   { background: rgba(0,212,255,.1); color: var(--cyan); border: 1px solid var(--cyan); }
.btn-resolve {
  padding: 5px 14px;
  background: transparent;
  border: 1px solid var(--green);
  color: var(--green);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  flex-shrink: 0;
}
.btn-resolve:hover { background: rgba(0,200,150,.1); }

/* Resolve modal */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}
.modal-header h2 { font-size: 16px; color: var(--bright); margin: 0; }
.modal-close {
  background: transparent;
  border: none;
  color: var(--text);
  cursor: pointer;
  font-size: 13px;
  padding: 2px 8px;
}
.modal-section { margin-bottom: 20px; }
.modal-section h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: var(--text); margin-bottom: 8px; }
.modal-section p { font-size: 13px; color: var(--bright); line-height: 1.6; margin: 0; }
.modal-section.risk p { color: var(--amber); }
.actions-list { display: flex; flex-direction: column; gap: 14px; }
.action-option {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 14px;
}
.action-option-header { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.action-option-header strong { font-size: 13px; color: var(--bright); }
.tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  font-family: 'JetBrains Mono', monospace;
}
.tag.reversible { background: rgba(0,200,150,.1); color: var(--green); border: 1px solid var(--green); }
.tag.permanent  { background: rgba(255,34,68,.1);  color: var(--red);   border: 1px solid var(--red); }
.action-desc { font-size: 12px; color: var(--text); margin: 0 0 10px; line-height: 1.5; }
.action-steps { margin-bottom: 10px; }
.action-steps summary { font-size: 12px; color: var(--cyan); cursor: pointer; }
.action-steps ol { margin: 8px 0 0 18px; }
.action-steps li { font-size: 12px; color: var(--text); margin-bottom: 4px; line-height: 1.5; }
.action-script {
  background: var(--navy);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 10px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--green);
  overflow-x: auto;
  margin: 8px 0;
  white-space: pre;
}
.btn-action {
  padding: 7px 18px;
  background: var(--green);
  color: #000;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}
.btn-action.destructive { background: var(--red); color: #fff; }
.btn-action:hover { opacity: .85; }
.modal-section.dismiss { border-top: 1px solid var(--border); padding-top: 16px; display: flex; align-items: center; gap: 12px; }
.btn-dismiss { padding: 6px 14px; background: transparent; border: 1px solid var(--text); color: var(--text); border-radius: 4px; cursor: pointer; font-size: 12px; }
.btn-dismiss:hover { border-color: var(--bright); color: var(--bright); }
.dismiss-note { font-size: 11px; color: var(--text); flex: 1; }
.badge-count {
  display: inline-block;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  background: var(--amber);
  color: #000;
  font-size: 10px;
  font-weight: 700;
  text-align: center;
  line-height: 18px;
  padding: 0 4px;
  margin-left: 6px;
  vertical-align: middle;
}
```

---

## Step 4: Wire Widget Into Dashboard

In `dashboard.html`:
1. Add a `<div id="pending-actions-list"></div>` section in an appropriate panel. If there is a
   "Response" or "Security" tab, place the pending-actions widget there. If not, place it in the
   main content area near the top, above the incident timeline.
2. Add `<script src="/dashboard/js/widgets/pending-actions.js"></script>` to the script loading
   section (after the other widget scripts).
3. Add `void DashboardPendingActions.load()` to the global refresh function if one exists.

---

## Verification

Manual test flow:
1. POST a test event to `/api/events` with `event_type: 'anomaly_detected'`, `severity: 'critical'`
2. Open the Scout dashboard
3. A pending action card should appear in the pending-actions widget
4. Click "Review" - the modal should open
5. The modal should show: the playbook title, what happened, what is at risk, and action buttons
6. Click "Switch to restricted mode" - it should call the execute endpoint and show a success message
7. The pending action card should disappear from the list
8. The action should appear in the action audit trail (Prompt 06 widget)
