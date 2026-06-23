# Prompt 17: MCP, ACP, IDE, Host Status, and Logs

You are working in the Carina mono-repo at `core.carinaai.uk/`.

## What already exists

**MCP backend:**
- `src/mcp/registry.ts` - `registerMcpServer(spec)`, `listMcpServers()`, `getMcpServer(id)`, `McpServerSpec`
- `src/mcp/http-client.ts` - HTTP MCP client
- `src/mcp/stdio-client.ts` - stdio MCP client
- `src/mcp/server/` - Carina-as-MCP-server implementation

**ACP backend:**
- `src/gateway/acp.ts` - ACP gateway, `setupAcpRoutes(app)`
- `src/gateway/acp-ide.ts` - IDE integration routes, `setupAcpIdeRoutes(app)`
- `src/gateway/acp-compliance.ts` - compliance checks
- `src/infrastructure/acp-bridge/` - ACP bridge adapters

**Observability backend:**
- `src/api/observability-routes.ts` - `setupObservabilityRoutes(app)`, exports log endpoints
- `src/api/observability-routes.test.ts` - tests exist

**Process API:**
- `src/api/process-api.ts` - `/api/process/status` route, CPU/memory/uptime/pid

**Control routes:**
- `src/api/control-routes.ts` - admin control: restart, reload, flush
- `src/api/control-routes.test.ts` - tests exist

**Ops routes:**
- `src/api/ops-routes.ts` - operator routes
- `src/api/carina-ops-routes.ts` - Carina-specific ops

**No GUI pages exist for MCP, ACP, or logs.**

## Part A: MCP management tab in settings

Rather than a standalone page, surface MCP state as a tab in the existing `/settings` page.

### Step 1: Add MCP API routes

Check if `src/api/ops-routes.ts` already exposes MCP data. If not, create `src/api/mcp-api.ts`:

```typescript
import { Router, type Request, type Response } from 'express';
import { listMcpServers, getMcpServer } from '../mcp/registry.js';

export const mcpApiRouter = Router();

mcpApiRouter.get('/servers', (_req, res) => {
  res.json({ servers: listMcpServers() });
});

mcpApiRouter.get('/servers/:id', (req, res) => {
  const s = getMcpServer(req.params.id);
  if (!s) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(s);
});
```

Mount in `createWebServer()`:
```typescript
import { mcpApiRouter } from '#core/api/mcp-api.js';
app.use('/api/mcp', requireAuth, mcpApiRouter);
```

### Step 2: MCP tab HTML in `packages/web/assets/web/settings.html`

Add a "MCP" tab button alongside existing settings tabs. MCP panel content:

```html
<div id="tab-mcp" hidden>
  <div style="padding:0.65rem 0;font-size:0.78rem;color:var(--muted);margin-bottom:0.5rem;">
    MCP (Model Context Protocol) servers extend Carina with external tools and resources.
  </div>
  <div id="mcp-list"></div>
  <div style="margin-top:1rem;font-size:0.75rem;color:var(--muted);">
    Add MCP servers in .env as <code>MCP_SERVER_0={"id":"...","transport":"...","command":"..."}</code>
    or register them programmatically via <code>registerMcpServer()</code>.
  </div>
</div>
```

MCP server card:
```html
<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:0.65rem 0.85rem;margin-bottom:0.4rem;">
  <div style="font-size:0.84rem;font-weight:600;">SERVER_NAME</div>
  <div style="font-size:0.72rem;color:var(--muted);">Transport: TRANSPORT | ID: ID</div>
</div>
```

JS for MCP tab:
```javascript
function loadMcp() {
  var listEl = document.getElementById('mcp-list');
  listEl.innerHTML = '<div class="skeleton" style="height:60px;border-radius:8px;"></div>';
  fetch('/api/mcp/servers')
    .then(function(r){return r.json();})
    .then(function(d) {
      var servers = d.servers || [];
      if (!servers.length) {
        listEl.innerHTML = '<div style="font-size:0.82rem;color:var(--muted);padding:0.5rem 0;">No MCP servers registered.</div>';
        return;
      }
      listEl.innerHTML = servers.map(function(s) {
        return '<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:0.65rem 0.85rem;margin-bottom:0.4rem;">' +
          '<div style="font-size:0.84rem;font-weight:600;">' + escapeHtml(s.name || s.id) + '</div>' +
          '<div style="font-size:0.72rem;color:var(--muted);">Transport: ' + escapeHtml(s.transport || 'unknown') + ' | ID: ' + escapeHtml(s.id) + '</div>' +
        '</div>';
      }).join('');
    });
}
```

## Part B: Logs page

### Step 1: Add `'logs'` to `WorkspacePageId` in `packages/web/src/workspace-chrome.ts`

```typescript
| 'logs'
```

### Step 2: Add nav item

```typescript
{
  id: 'logs',
  href: '/logs',
  label: 'Logs',
  description: 'Live and recent request and event logs',
},
```

### Step 3: Check observability routes

Look at `src/api/observability-routes.ts` for existing endpoints. Expected:
- GET /api/observability/logs - paginated log stream
- GET /api/observability/events - event feed
- GET /api/observability/metrics - counters

Confirm what `setupObservabilityRoutes(app)` registers. If logs endpoint is at a different path, use that in the frontend.

### Step 4: Create `packages/web/assets/web/logs.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#0d0d0f">
<title>Logs; Carina</title>
<style>
  body { display:flex; flex-direction:column; height:100vh; }
  .logs-wrap { flex:1; display:flex; flex-direction:column; overflow:hidden; }
  .logs-toolbar { display:flex; gap:0.5rem; align-items:center; padding:0.65rem 0.85rem; border-bottom:1px solid var(--border); flex-wrap:wrap; }
  .logs-toolbar input { background:var(--surface-2); border:1px solid var(--border); color:var(--text); border-radius:6px; padding:0.35rem 0.6rem; font-size:0.8rem; flex:1; min-width:160px; }
  .logs-toolbar select { background:var(--surface-2); border:1px solid var(--border); color:var(--text); border-radius:6px; padding:0.35rem 0.6rem; font-size:0.8rem; }
  .logs-toolbar button { background:var(--surface-2); border:1px solid var(--border); color:var(--text); border-radius:6px; padding:0.35rem 0.7rem; font-size:0.8rem; cursor:pointer; }
  .logs-toolbar button.active { background:var(--accent); color:#0d0d0f; border-color:transparent; }
  .log-stream { flex:1; overflow-y:auto; font-family:monospace; font-size:0.76rem; line-height:1.5; padding:0.5rem 0.85rem; }
  .log-row { display:flex; gap:0.6rem; align-items:baseline; padding:0.18rem 0; border-bottom:1px solid rgba(255,255,255,0.04); }
  .log-time { color:var(--muted); white-space:nowrap; flex-shrink:0; }
  .log-level { width:4.5rem; flex-shrink:0; text-align:center; border-radius:3px; font-size:0.65rem; padding:0.05rem 0.3rem; font-weight:700; }
  .level-error { background:rgba(255,77,106,0.15); color:var(--danger); }
  .level-warn { background:rgba(251,191,36,0.12); color:#fbbf24; }
  .level-info { background:rgba(108,140,255,0.1); color:var(--accent); }
  .level-debug { background:rgba(255,255,255,0.05); color:var(--muted); }
  .log-msg { flex:1; min-width:0; word-break:break-all; color:var(--text); }
  #empty-logs { flex:1; display:flex; align-items:center; justify-content:center; color:var(--muted); font-size:0.85rem; }
</style>
</head>
<body>
<!--CARINA_WORKSPACE_BEGIN-->
<header class="ws-page-header">
  <h1>Logs</h1>
  <span class="status" id="status"></span>
</header>
<div class="logs-wrap">
  <div class="logs-toolbar">
    <input id="log-search" type="search" placeholder="Filter logs...">
    <select id="log-level">
      <option value="">All levels</option>
      <option value="error">Error</option>
      <option value="warn">Warn</option>
      <option value="info">Info</option>
      <option value="debug">Debug</option>
    </select>
    <select id="log-source">
      <option value="">All sources</option>
      <option value="chat">Chat</option>
      <option value="skill">Skill</option>
      <option value="tool">Tool</option>
      <option value="channel">Channel</option>
      <option value="system">System</option>
    </select>
    <button id="auto-scroll-btn" class="active">Auto-scroll</button>
    <button id="clear-btn">Clear</button>
    <button id="refresh-btn">Refresh</button>
  </div>
  <div class="log-stream" id="log-stream">
    <div id="empty-logs">No logs yet. Logs appear here as Carina processes requests.</div>
  </div>
</div>
<!--CARINA_WORKSPACE_END-->
<script src="/logs.js"></script>
</body>
</html>
```

### Step 5: Create `packages/web/assets/web/logs.js`

IIFE that:
- On load: GET /api/observability/logs (or whatever the actual path is) and render rows
- Filter input: client-side filter of rendered rows (debounced 200ms)
- Level/source selectors: re-fetch with params or client-side filter
- Auto-scroll: when enabled, scrolling to bottom after each render
- Clear: clears the rendered list (not server-side)
- Refresh: re-fetch
- Polls every 10 seconds if "Auto-scroll" is active (replaces SSE if SSE not available)

If the observability routes support SSE (`text/event-stream`), use EventSource instead of polling:
```javascript
var sse = new EventSource('/api/observability/events');
sse.onmessage = function(e) {
  appendLogRow(JSON.parse(e.data));
};
```

Log row render:
```javascript
function renderRow(entry) {
  var levelCls = 'level-' + (entry.level || 'info');
  return '<div class="log-row">' +
    '<div class="log-time">' + escapeHtml(entry.time ? new Date(entry.time).toLocaleTimeString() : '') + '</div>' +
    '<div class="log-level ' + levelCls + '">' + escapeHtml((entry.level || 'info').toUpperCase()) + '</div>' +
    '<div class="log-msg">' + escapeHtml(entry.msg || entry.message || '') + '</div>' +
  '</div>';
}
```

### Step 6: Register logs page in `createWebServer()`

```typescript
const logsHtml = decoratePageHtml(
  await fs.readFile(path.join(WEB_STATIC, 'logs.html'), 'utf-8').catch(() => null),
  carinaVersion,
  { workspacePage: 'logs' },
);
if (logsHtml) {
  app.get('/logs', (_req, res) => { res.type('html').send(logsHtml); });
}
app.get('/logs.js', (_req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'logs.js'));
});
```

## Part C: ACP status indicator

ACP and IDE endpoints are already mounted by `setupAcpRoutes(app)` and `setupAcpIdeRoutes(app)`. Surface their status as a banner or badge in the settings page.

Add to settings page JS:
```javascript
fetch('/acp/status', { method: 'GET' }).then(function(r){
  if (r.ok) return r.json();
  throw new Error('ACP not available');
}).then(function(d) {
  var el = document.getElementById('acp-status-badge');
  if (el) el.textContent = 'ACP: ' + (d.status || 'active');
}).catch(function() {
  var el = document.getElementById('acp-status-badge');
  if (el) { el.textContent = 'ACP: disabled'; el.style.color = 'var(--muted)'; }
});
```

Add to settings.html somewhere visible:
```html
<div id="acp-status-badge" style="font-size:0.75rem;"></div>
```

Also add ACP docs link: `/acp/docs` renders the ACP OpenAPI spec browser.

## Tests

Create `src/api/mcp-api.test.ts`:
- GET /api/mcp/servers returns `{ servers: [] }` when none registered
- GET /api/mcp/servers/:id returns 404 for unknown id

Add to `src/api/observability-routes.test.ts` if not already present:
- GET /api/observability/logs returns array of log entries
- GET /api/observability/metrics returns counters object

## Acceptance criteria

- Settings page has a "MCP" tab listing registered MCP servers
- `/logs` is a live filterable log viewer
- Logs auto-scroll as new entries arrive (poll or SSE)
- Level and source filters narrow the log view client-side
- ACP status is visible on the settings page
- All new routes are authenticated via `requireAuth`
