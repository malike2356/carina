# Prompt 21: Ops and Admin Control Plane

You are working in the Carina mono-repo at `core.carinaai.uk/`.

## What already exists

**Ops routes (already mounted in `web-server.ts` via `mountOpsRoutes(app)`):**
- `POST /api/ops/reload-secrets` - hot-reload secrets from env
- `GET /api/ops/health` - basic health check
- `GET /api/ops/skill-packs` - list installed skill packs
- `PUT /api/ops/skill-packs` - update skill pack configuration
- `GET /api/ops/web-password` - check if web password is set
- `PUT /api/ops/web-password` - update web password
- `GET /api/ops/extensions` - list extensions (basic)
- `GET /api/ops/eval-reports` - evaluation reports
- `GET /api/ops/tenant-config/:tenantId` - tenant config (hosted only)
- `PUT /api/ops/tenant-config/:tenantId` - update tenant config

**Control routes (mounted via `mountControlRoutes(app)`):**
- `GET /api/control/status` - process status, version, uptime, memory
- `GET /api/control/agents` - list running agents
- `GET /api/control/devices` - list paired devices
- `DELETE /api/control/devices/:id` - unpair device
- `POST /api/control/reload-secrets` - reload (duplicate of ops route)

**Carina ops routes (mounted via `mountCarinaOpsRoutes(app)`):**
- Check `src/api/carina-ops-routes.ts` for what additional routes exist

**Existing settings page:**
- `packages/web/assets/web/settings.html` - operator settings UI
- Served at GET `/settings`

**Observability routes:**
- `setupObservabilityRoutes(app)` mounts log/event/metrics endpoints

## What to build

This prompt wires existing ops routes into the settings and control pages so operators do not need CLI for routine tasks. No new backend is needed; only the GUI surfaces.

## Part A: Enhance settings page with ops controls

Read `packages/web/assets/web/settings.html` and `packages/web/assets/web/settings.js` (or inline script) to understand the current tabs. Add the following tabs if not present:

### Tab: System

Sources: `GET /api/control/status`

```html
<div id="tab-system" hidden>
  <div class="settings-section">
    <h2>Process</h2>
    <div class="settings-row"><span>Version</span><span id="sys-version">--</span></div>
    <div class="settings-row"><span>Uptime</span><span id="sys-uptime">--</span></div>
    <div class="settings-row"><span>Memory (MB)</span><span id="sys-mem">--</span></div>
    <div class="settings-row"><span>PID</span><span id="sys-pid">--</span></div>
    <div class="settings-row"><span>Node.js</span><span id="sys-node">--</span></div>
    <div class="settings-row"><span>Mode</span><span id="sys-mode">--</span></div>
  </div>
  <div class="settings-section">
    <h2>Actions</h2>
    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
      <button id="reload-secrets-btn" class="settings-action-btn">Reload secrets</button>
    </div>
    <div id="ops-action-status" style="font-size:0.75rem;color:var(--muted);margin-top:0.5rem;"></div>
  </div>
</div>
```

JS to populate system tab:
```javascript
function loadSystemStatus() {
  fetch('/api/control/status')
    .then(function(r){return r.json();})
    .then(function(d) {
      var set = function(id, val) { var el = document.getElementById(id); if (el) el.textContent = val || '--'; };
      set('sys-version', d.version);
      set('sys-uptime', d.uptime ? Math.floor(d.uptime / 60) + ' min' : '--');
      set('sys-mem', d.memoryMb ? Math.round(d.memoryMb) + ' MB' : '--');
      set('sys-pid', d.pid);
      set('sys-node', d.node);
      set('sys-mode', d.mode);
    })
    .catch(function(){});
}

var reloadSecretsBtn = document.getElementById('reload-secrets-btn');
var opsStatus = document.getElementById('ops-action-status');
if (reloadSecretsBtn) {
  reloadSecretsBtn.addEventListener('click', function() {
    reloadSecretsBtn.disabled = true;
    fetch('/api/ops/reload-secrets', { method: 'POST' })
      .then(function(r){return r.json();})
      .then(function() {
        if (opsStatus) { opsStatus.textContent = 'Secrets reloaded'; opsStatus.style.color = '#4ade80'; }
      })
      .catch(function(err) {
        if (opsStatus) { opsStatus.textContent = 'Error: ' + err.message; opsStatus.style.color = 'var(--danger)'; }
      })
      .finally(function() { reloadSecretsBtn.disabled = false; });
  });
}
```

Activate `loadSystemStatus()` when the System tab is opened.

### Tab: Agents

Sources: `GET /api/control/agents`

```html
<div id="tab-agents" hidden>
  <div style="font-size:0.78rem;color:var(--muted);margin-bottom:0.65rem;">Currently running or registered agents.</div>
  <div id="agent-list"></div>
  <button id="refresh-agents" class="settings-action-btn" style="margin-top:0.5rem;">Refresh</button>
</div>
```

JS:
```javascript
function loadAgents() {
  var listEl = document.getElementById('agent-list');
  if (!listEl) return;
  listEl.innerHTML = '<div class="skeleton" style="height:52px;border-radius:8px;"></div>';
  fetch('/api/control/agents')
    .then(function(r){return r.json();})
    .then(function(d) {
      var agents = d.agents || [];
      if (!agents.length) {
        listEl.innerHTML = '<div style="font-size:0.82rem;color:var(--muted);">No active agents.</div>';
        return;
      }
      listEl.innerHTML = agents.map(function(a) {
        return '<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.75rem;margin-bottom:0.35rem;">' +
          '<div style="font-size:0.84rem;font-weight:600;">' + escapeHtml(a.name || a.id) + '</div>' +
          '<div style="font-size:0.72rem;color:var(--muted);">Status: ' + escapeHtml(a.status || 'unknown') + (a.startedAt ? ' | Started: ' + new Date(a.startedAt).toLocaleTimeString() : '') + '</div>' +
        '</div>';
      }).join('');
    })
    .catch(function() {
      listEl.innerHTML = '<div style="font-size:0.82rem;color:var(--muted);">Failed to load agents.</div>';
    });
}

var refreshAgentsBtn = document.getElementById('refresh-agents');
if (refreshAgentsBtn) {
  refreshAgentsBtn.addEventListener('click', loadAgents);
}
```

### Tab: Eval Reports

Sources: `GET /api/ops/eval-reports`

```html
<div id="tab-eval" hidden>
  <div id="eval-report-list"></div>
</div>
```

JS:
```javascript
function loadEvalReports() {
  var listEl = document.getElementById('eval-report-list');
  if (!listEl) return;
  listEl.innerHTML = '<div class="skeleton" style="height:80px;border-radius:8px;"></div>';
  fetch('/api/ops/eval-reports')
    .then(function(r){return r.json();})
    .then(function(d) {
      var reports = d.reports || [];
      if (!reports.length) {
        listEl.innerHTML = '<div style="font-size:0.82rem;color:var(--muted);padding:1rem 0;">No eval reports found.</div>';
        return;
      }
      listEl.innerHTML = reports.map(function(r) {
        var passed = r.passRate != null ? Math.round(r.passRate * 100) + '% pass' : '';
        return '<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.85rem;margin-bottom:0.4rem;">' +
          '<div style="font-size:0.84rem;font-weight:600;">' + escapeHtml(r.name || r.id) + '</div>' +
          '<div style="font-size:0.72rem;color:var(--muted);">' + escapeHtml(passed) + (r.runAt ? ' | ' + new Date(r.runAt).toLocaleString() : '') + '</div>' +
        '</div>';
      }).join('');
    })
    .catch(function(){});
}
```

### Tab: Skill Packs (if not already in settings)

Sources: `GET /api/ops/skill-packs`

Show list of installed packs. Each pack: name, version, enabled toggle, "Uninstall" button.

```javascript
function loadSkillPacks() {
  var listEl = document.getElementById('packs-ops-list');
  if (!listEl) return;
  fetch('/api/ops/skill-packs')
    .then(function(r){return r.json();})
    .then(function(d) {
      var packs = d.packs || [];
      listEl.innerHTML = packs.map(function(p) {
        return '<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.75rem;margin-bottom:0.35rem;display:flex;align-items:center;gap:0.5rem;">' +
          '<div style="flex:1;">' +
            '<div style="font-size:0.84rem;font-weight:600;">' + escapeHtml(p.name) + '</div>' +
            '<div style="font-size:0.72rem;color:var(--muted);">v' + escapeHtml(p.version || '?') + ' | ' + (p.enabled ? 'Enabled' : 'Disabled') + '</div>' +
          '</div>' +
        '</div>';
      }).join('') || '<div style="font-size:0.82rem;color:var(--muted);">No skill packs installed.</div>';
    });
}
```

## Part B: Control plane status page

Create a dedicated `/control` page for operators who need a full-screen control panel.

### Step 1: Add `'control'` to `WorkspacePageId`

```typescript
| 'control'
```

This is an admin-only page; do not add it to `WORKSPACE_NAV_ITEMS` (it should not appear in the sidebar). Access it directly at `/control` or link to it from the settings page.

### Step 2: Load control HTML in `createWebServer()`

```typescript
const controlHtml = decoratePageHtml(
  await fs.readFile(path.join(WEB_STATIC, 'control.html'), 'utf-8').catch(() => null),
  carinaVersion,
  { workspacePage: 'control' },
);
if (controlHtml) {
  app.get('/control', requireAuth, (_req, res) => { res.type('html').send(controlHtml); });
}
app.get('/control.js', (_req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'control.js'));
});
```

### Step 3: Create `packages/web/assets/web/control.html`

Full-width dashboard with cards for: status, agents, devices, eval reports, recent logs, skill packs.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#0d0d0f">
<title>Control Plane; Carina</title>
<style>
  .ctrl-wrap { flex:1; overflow-y:auto; padding:1rem 1.25rem 2rem; }
  .ctrl-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:0.85rem; }
  .ctrl-card { background:var(--surface-2); border:1px solid var(--border); border-radius:10px; padding:0.85rem 1rem; }
  .ctrl-card h3 { font-size:0.78rem; text-transform:uppercase; letter-spacing:0.04em; color:var(--muted); margin-bottom:0.65rem; }
  .ctrl-row { display:flex; justify-content:space-between; font-size:0.82rem; padding:0.25rem 0; border-bottom:1px solid rgba(255,255,255,0.04); }
  .ctrl-row .label { color:var(--muted); }
  .ctrl-row .value { font-weight:500; }
  .ctrl-actions { display:flex; gap:0.4rem; flex-wrap:wrap; margin-top:0.5rem; }
  .ctrl-btn { background:var(--surface); border:1px solid var(--border); color:var(--text); border-radius:6px; padding:0.3rem 0.6rem; font-size:0.75rem; cursor:pointer; }
  .ctrl-btn:disabled { opacity:0.5; cursor:not-allowed; }
</style>
</head>
<body>
<!--CARINA_WORKSPACE_BEGIN-->
<header class="ws-page-header">
  <h1>Control Plane</h1>
  <span class="status" id="status"></span>
</header>
<div class="ctrl-wrap">
  <div class="ctrl-grid">
    <div class="ctrl-card">
      <h3>Process</h3>
      <div class="ctrl-row"><span class="label">Version</span><span class="value" id="cp-version">--</span></div>
      <div class="ctrl-row"><span class="label">Uptime</span><span class="value" id="cp-uptime">--</span></div>
      <div class="ctrl-row"><span class="label">Memory</span><span class="value" id="cp-mem">--</span></div>
      <div class="ctrl-row"><span class="label">Mode</span><span class="value" id="cp-mode">--</span></div>
      <div class="ctrl-actions">
        <button class="ctrl-btn" id="cp-reload-secrets">Reload secrets</button>
      </div>
      <div id="cp-action-msg" style="font-size:0.72rem;color:var(--muted);margin-top:0.4rem;"></div>
    </div>
    <div class="ctrl-card">
      <h3>Active agents</h3>
      <div id="cp-agents"></div>
    </div>
    <div class="ctrl-card">
      <h3>Paired devices</h3>
      <div id="cp-devices"></div>
    </div>
    <div class="ctrl-card">
      <h3>Eval reports</h3>
      <div id="cp-evals"></div>
    </div>
  </div>
</div>
<!--CARINA_WORKSPACE_END-->
<script src="/control.js"></script>
</body>
</html>
```

### Step 4: Create `packages/web/assets/web/control.js`

IIFE that:
- On load: fetch all four endpoints in parallel (`Promise.all`)
- Populate each card
- "Reload secrets" button: POST /api/ops/reload-secrets
- Auto-refresh every 30 seconds (clear before fetch, set status timestamp)
- Each card shows "Updated: HH:MM:SS" footer

```javascript
(function () {
  function escapeHtml(t) {
    return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function setText(id, val) { var el = document.getElementById(id); if (el) el.textContent = String(val || '--'); }

  function loadAll() {
    document.getElementById('status').textContent = 'Refreshing...';
    Promise.all([
      fetch('/api/control/status').then(function(r){return r.json();}).catch(function(){return {};}),
      fetch('/api/control/agents').then(function(r){return r.json();}).catch(function(){return {agents:[]};}),
      fetch('/api/control/devices').then(function(r){return r.json();}).catch(function(){return {devices:[]};}),
      fetch('/api/ops/eval-reports').then(function(r){return r.json();}).catch(function(){return {reports:[]};}),
    ]).then(function(results) {
      var status = results[0], agentsData = results[1], devicesData = results[2], evalsData = results[3];

      // Process card
      setText('cp-version', status.version);
      setText('cp-uptime', status.uptime ? Math.floor(status.uptime / 60) + ' min' : '--');
      setText('cp-mem', status.memoryMb ? Math.round(status.memoryMb) + ' MB' : '--');
      setText('cp-mode', status.mode);

      // Agents card
      var agents = agentsData.agents || [];
      document.getElementById('cp-agents').innerHTML = agents.length
        ? agents.map(function(a){
            return '<div style="font-size:0.8rem;padding:0.2rem 0;">' + escapeHtml(a.name || a.id) +
              ' <span style="color:var(--muted);font-size:0.7rem;">(' + escapeHtml(a.status || '') + ')</span></div>';
          }).join('')
        : '<div style="font-size:0.8rem;color:var(--muted);">No active agents</div>';

      // Devices card
      var devices = devicesData.devices || [];
      document.getElementById('cp-devices').innerHTML = devices.length
        ? devices.map(function(d){
            return '<div style="font-size:0.8rem;padding:0.2rem 0;display:flex;align-items:center;gap:0.5rem;">' +
              escapeHtml(d.name || d.id) +
              '<button data-device="' + escapeHtml(d.id) + '" style="font-size:0.68rem;background:none;border:1px solid var(--border);color:var(--danger);border-radius:4px;padding:0.1rem 0.35rem;cursor:pointer;margin-left:auto;">Unpair</button>' +
            '</div>';
          }).join('')
        : '<div style="font-size:0.8rem;color:var(--muted);">No paired devices</div>';

      document.getElementById('cp-devices').querySelectorAll('[data-device]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          if (!confirm('Unpair this device?')) return;
          fetch('/api/control/devices/' + btn.dataset.device, { method: 'DELETE' }).then(loadAll);
        });
      });

      // Evals card
      var reports = evalsData.reports || [];
      document.getElementById('cp-evals').innerHTML = reports.length
        ? reports.slice(0, 5).map(function(r){
            return '<div style="font-size:0.78rem;padding:0.2rem 0;">' + escapeHtml(r.name || r.id) +
              (r.passRate != null ? ' <span style="color:var(--muted);font-size:0.7rem;">(' + Math.round(r.passRate*100) + '% pass)</span>' : '') +
            '</div>';
          }).join('')
        : '<div style="font-size:0.8rem;color:var(--muted);">No eval reports</div>';

      document.getElementById('status').textContent = 'Updated ' + new Date().toLocaleTimeString();
    });
  }

  document.getElementById('cp-reload-secrets').addEventListener('click', function() {
    var btn = document.getElementById('cp-reload-secrets');
    var msg = document.getElementById('cp-action-msg');
    btn.disabled = true;
    fetch('/api/ops/reload-secrets', { method: 'POST' })
      .then(function(r){return r.json();})
      .then(function() { if (msg) { msg.textContent = 'Secrets reloaded'; msg.style.color = '#4ade80'; } })
      .catch(function(err) { if (msg) { msg.textContent = 'Error: ' + err.message; msg.style.color = 'var(--danger)'; } })
      .finally(function() { btn.disabled = false; });
  });

  loadAll();
  setInterval(loadAll, 30_000);
})();
```

Add settings page link to control plane:
```html
<!-- In settings.html near header -->
<a href="/control" style="font-size:0.75rem;color:var(--accent);">Open control plane</a>
```

## Tests

Verify existing tests still pass:
- `src/api/control-routes.test.ts` - all control routes
- `src/api/ops-routes.test.ts` - all ops routes
- `src/api/carina-ops-routes.test.ts` - carina ops routes

New integration check: verify settings page has all tabs without JavaScript errors (load the HTML, confirm tab buttons have correct `data-tab` values that match the `id` of tab content divs).

For control page, add to `src/api/control-routes.test.ts`:
- GET /api/control/status returns `{ version, uptime, memoryMb, pid, mode }`
- GET /api/control/agents returns `{ agents: [] }`
- GET /api/control/devices returns `{ devices: [] }`
- DELETE /api/control/devices/:id returns 204 or 404

## Acceptance criteria

- Settings page has System, Agents, Eval Reports, and Skill Packs tabs
- System tab shows version, uptime, memory with live data from /api/control/status
- "Reload secrets" from settings System tab works without page reload
- `/control` is a full-width ops dashboard refreshed every 30 seconds
- Device unpairing works from the control plane Devices card
- Eval reports are browsable from control plane without CLI
- All new HTML/JS loads without console errors
