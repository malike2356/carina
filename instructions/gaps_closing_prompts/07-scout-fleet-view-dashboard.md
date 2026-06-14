# Prompt: Labyrinth Scout Fleet View Dashboard

## What to build

A "Fleet" tab in the Scout dashboard that shows all registered Carina agent instances as cards in a grid: live status, heartbeat age, per-agent 24h event counts, and per-agent kill/resume controls. The current `instances-bar` is a compact horizontal chip row - it is not a fleet view. This builds the full dedicated view.

## What already exists - read all of these before writing anything

**Data layer (complete - do not rebuild):**
- `src/dashboard/widgets/agent-status.ts` - `buildAgentStatus(rows)` returns `AgentStatusSummary` with `{ total, active, suspended, offline, agents[] }`. Each agent has `id, name, status ('active'|'suspended'|'offline'), secondsAgo, suspensionReason`. Read fully (50 lines).
- `src/api/instances.ts` - `GET /api/instances/:instanceId/status` and `POST /api/instances/register`.
- `src/api/kill.ts` - `POST /api/kill/:instanceId` with `{ reason }` body. Suspends one agent and publishes Redis control message.
- `src/api/resume.ts` - `POST /api/resume/:instanceId`. Resumes one suspended agent.
- `src/api/sse.ts` - `broadcastEvent()` emits `agent_update` SSE event on heartbeat. The client already listens on `/api/events` (SSE stream).
- `src/api/dashboard.ts` - `GET /api/dashboard/agent-status` returns `AgentStatusSummary` (scoped to account). Read lines 120-140 for the query shape.

**Dashboard shell (do not restructure):**
- `public/dashboard.html` - single HTML file with all tabs. The nav is at line 513 (`<nav class="dash-tabs">`). Existing tabs: Security, Defense, Governance. Tab content panels use `hidden` attribute toggled by JS. The `instances-bar` (line 725) is the horizontal chip row - keep it, the fleet view is a separate tab.
- `public/dashboard/js/widgets/` - one JS file per widget. Pattern: each widget exports a `render*(data)` function called from the main dashboard JS after a fetch.
- CSS variables in `dashboard.html` head: `--void`, `--navy`, `--lift`, `--border`, `--cyan`, `--green`, `--amber`, `--red`, `--text`, `--bright`. Use these - do not introduce new colour values.

## Step 1: New API endpoint - GET /api/dashboard/fleet

Add to `src/api/dashboard.ts`:

```typescript
dashboardRouter.get('/fleet', async (req: Request, res: Response): Promise<void> => {
  const accountId = scopedAccountId(req);
  try {
    const [agentRows, eventRows] = await Promise.all([
      pool.query<{ id: string; name: string; status: string; suspension_reason: string | null; last_heartbeat: Date | null }>(
        accountId
          ? `SELECT id, name, status, suspension_reason, last_heartbeat
             FROM carina_instances WHERE account_id = $1 ORDER BY created_at ASC`
          : `SELECT id, name, status, suspension_reason, last_heartbeat
             FROM carina_instances ORDER BY created_at ASC`,
        accountId ? [accountId] : [],
      ),
      pool.query<{ instance_id: string; severity: string; count: string }>(
        accountId
          ? `SELECT e.instance_id, e.severity, COUNT(*)::text AS count
             FROM security_events e
             JOIN carina_instances i ON i.id = e.instance_id
             WHERE i.account_id = $1 AND e.created_at > NOW() - INTERVAL '24 hours'
             GROUP BY e.instance_id, e.severity`
          : `SELECT instance_id, severity, COUNT(*)::text AS count
             FROM security_events
             WHERE created_at > NOW() - INTERVAL '24 hours'
             GROUP BY instance_id, severity`,
        accountId ? [accountId] : [],
      ),
    ]);

    const countsByInstance = new Map<string, Record<string, number>>();
    for (const row of eventRows.rows) {
      if (!row.instance_id) continue;
      const map = countsByInstance.get(row.instance_id) ?? {};
      map[row.severity] = Number(row.count);
      countsByInstance.set(row.instance_id, map);
    }

    const agents = buildAgentStatus(agentRows.rows);
    const fleet = agents.agents.map((agent) => {
      const counts = countsByInstance.get(agent.id) ?? {};
      return {
        ...agent,
        events24h: {
          critical: counts['critical'] ?? 0,
          warning: counts['warning'] ?? 0,
          info: counts['info'] ?? 0,
          breach: counts['breach'] ?? 0,
        },
      };
    });

    res.json({ total: agents.total, active: agents.active, suspended: agents.suspended, offline: agents.offline, fleet });
  } catch (err) {
    console.error('[dashboard] fleet failed:', err);
    res.status(500).json({ error: 'Database error' });
  }
});
```

## Step 2: Fleet widget server module

Create `src/dashboard/widgets/fleet-summary.ts`:

```typescript
export interface FleetAgent {
  id: string;
  name: string;
  status: 'active' | 'suspended' | 'offline';
  secondsAgo: number | null;
  suspensionReason: string | null;
  events24h: { critical: number; warning: number; info: number; breach: number };
}

export interface FleetSummary {
  total: number;
  active: number;
  suspended: number;
  offline: number;
  fleet: FleetAgent[];
}
```

Write `src/dashboard/widgets/__tests__/fleet-summary.test.ts` (Vitest):
- An agent with `last_heartbeat` within 90s is `active`
- An agent with `last_heartbeat` older than 90s is `offline`
- An agent with `status = 'suspended'` is `suspended` regardless of heartbeat age
- `events24h` defaults all counts to 0 when no event rows exist for that instance
- Total/active/suspended/offline counts match the agent array

## Step 3: Fleet tab in dashboard.html

### 3a. Add nav tab

In the `<nav class="dash-tabs">` section (around line 513), add after the last existing tab link:

```html
<button class="tab-btn" data-tab="fleet" aria-controls="fleet-tab-content">Fleet</button>
```

### 3b. Add tab content panel

After the last existing tab content `<div>`, add:

```html
<div id="fleet-tab-content" hidden>
  <div class="fleet-summary-bar" id="fleet-summary-bar"></div>
  <div class="fleet-grid" id="fleet-grid"></div>
</div>
```

### 3c. Add CSS (in the `<style>` block in the `<head>`)

```css
.fleet-summary-bar {
  display: flex;
  gap: .6rem;
  margin-bottom: .75rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: .76rem;
}
.fleet-summary-pill {
  padding: .2rem .55rem;
  border-radius: 3px;
  border: 1px solid var(--border);
  color: var(--text);
}
.fleet-summary-pill.active  { border-color: var(--green); color: var(--green); }
.fleet-summary-pill.suspended { border-color: var(--amber); color: var(--amber); }
.fleet-summary-pill.offline { border-color: var(--border); color: var(--text); opacity: .6; }

.fleet-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: .6rem;
}
.fleet-card {
  background: var(--navy);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: .75rem .85rem;
  display: flex;
  flex-direction: column;
  gap: .45rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: .76rem;
}
.fleet-card.status-active    { border-left: 3px solid var(--green); }
.fleet-card.status-suspended { border-left: 3px solid var(--amber); }
.fleet-card.status-offline   { border-left: 3px solid var(--border); opacity: .7; }

.fleet-card-name {
  font-size: .82rem;
  color: var(--bright);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fleet-card-id   { font-size: .65rem; color: var(--text); }
.fleet-card-hb   { font-size: .68rem; color: var(--text); }
.fleet-card-events {
  display: flex;
  gap: .4rem;
  font-size: .65rem;
}
.fleet-ev-breach   { color: var(--red); }
.fleet-ev-critical { color: var(--red); opacity: .8; }
.fleet-ev-warning  { color: var(--amber); }
.fleet-ev-info     { color: var(--text); }

.fleet-card-actions { display: flex; gap: .4rem; margin-top: .2rem; }
.fleet-btn {
  font-family: 'JetBrains Mono', monospace;
  font-size: .65rem;
  padding: .2rem .45rem;
  border-radius: 2px;
  border: 1px solid;
  background: transparent;
  cursor: pointer;
  letter-spacing: .05em;
}
.fleet-btn-kill   { border-color: var(--red);   color: var(--red); }
.fleet-btn-resume { border-color: var(--green); color: var(--green); }
.fleet-btn:disabled { opacity: .35; cursor: not-allowed; }

.fleet-empty {
  grid-column: 1 / -1;
  color: var(--text);
  font-family: 'JetBrains Mono', monospace;
  font-size: .76rem;
  padding: 1.5rem;
  text-align: center;
}
```

## Step 4: Fleet widget JS

Create `public/dashboard/js/widgets/fleet.js`:

```javascript
// Fleet view: per-agent cards with live status, event counts, kill/resume controls.

let _fleetData = null;

export function renderFleet(data) {
  _fleetData = data;
  renderSummaryBar(data);
  renderGrid(data);
}

function renderSummaryBar(data) {
  const bar = document.getElementById('fleet-summary-bar');
  if (!bar) return;
  bar.innerHTML = `
    <span class="fleet-summary-pill">Total: ${data.total}</span>
    <span class="fleet-summary-pill active">Active: ${data.active}</span>
    <span class="fleet-summary-pill suspended">Suspended: ${data.suspended}</span>
    <span class="fleet-summary-pill offline">Offline: ${data.offline}</span>
  `;
}

function renderGrid(data) {
  const grid = document.getElementById('fleet-grid');
  if (!grid) return;
  if (!data.fleet || data.fleet.length === 0) {
    grid.innerHTML = '<div class="fleet-empty">No agents registered. A Carina agent registers automatically on first heartbeat.</div>';
    return;
  }
  grid.innerHTML = data.fleet.map(agentCard).join('');
  grid.querySelectorAll('.fleet-btn-kill').forEach((btn) => {
    btn.addEventListener('click', () => handleKill(btn.dataset.id, btn));
  });
  grid.querySelectorAll('.fleet-btn-resume').forEach((btn) => {
    btn.addEventListener('click', () => handleResume(btn.dataset.id, btn));
  });
}

function agentCard(agent) {
  const hbText = agent.secondsAgo === null
    ? 'never seen'
    : agent.secondsAgo < 60
      ? `${agent.secondsAgo}s ago`
      : `${Math.floor(agent.secondsAgo / 60)}m ago`;

  const ev = agent.events24h;
  const evParts = [];
  if (ev.breach)   evParts.push(`<span class="fleet-ev-breach">${ev.breach} breach</span>`);
  if (ev.critical) evParts.push(`<span class="fleet-ev-critical">${ev.critical} crit</span>`);
  if (ev.warning)  evParts.push(`<span class="fleet-ev-warning">${ev.warning} warn</span>`);
  if (ev.info)     evParts.push(`<span class="fleet-ev-info">${ev.info} info</span>`);
  const evHtml = evParts.length ? evParts.join('') : '<span class="fleet-ev-info">no events</span>';

  const isSuspended = agent.status === 'suspended';
  const isOffline   = agent.status === 'offline';

  const killBtn   = `<button class="fleet-btn fleet-btn-kill"   data-id="${agent.id}" ${isSuspended ? 'disabled' : ''}>KILL</button>`;
  const resumeBtn = isSuspended
    ? `<button class="fleet-btn fleet-btn-resume" data-id="${agent.id}">RESUME</button>`
    : '';

  const reasonLine = agent.suspensionReason
    ? `<div class="fleet-card-id">Reason: ${agent.suspensionReason}</div>`
    : '';

  return `
    <div class="fleet-card status-${agent.status}" id="fleet-card-${agent.id}" data-id="${agent.id}">
      <div class="fleet-card-name" title="${agent.id}">${agent.name}</div>
      <div class="fleet-card-id">${agent.id}</div>
      <div class="fleet-card-hb">Heartbeat: ${hbText}</div>
      ${reasonLine}
      <div class="fleet-card-events">${evHtml}</div>
      <div class="fleet-card-actions">${killBtn}${resumeBtn}</div>
    </div>
  `.trim();
}

async function handleKill(instanceId, btn) {
  const reason = window.prompt('Reason for suspension (required):');
  if (!reason || !reason.trim()) return;
  btn.disabled = true;
  try {
    const res = await fetch(`/api/kill/${encodeURIComponent(instanceId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason.trim() }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(`Kill failed: ${data.error ?? res.status}`);
      btn.disabled = false;
      return;
    }
    updateCardStatus(instanceId, 'suspended', reason.trim());
  } catch (err) {
    alert(`Kill failed: ${err.message}`);
    btn.disabled = false;
  }
}

async function handleResume(instanceId, btn) {
  btn.disabled = true;
  try {
    const res = await fetch(`/api/resume/${encodeURIComponent(instanceId)}`, { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(`Resume failed: ${data.error ?? res.status}`);
      btn.disabled = false;
      return;
    }
    updateCardStatus(instanceId, 'active', null);
  } catch (err) {
    alert(`Resume failed: ${err.message}`);
    btn.disabled = false;
  }
}

function updateCardStatus(instanceId, status, suspensionReason) {
  if (!_fleetData) return;
  _fleetData.fleet = _fleetData.fleet.map((a) =>
    a.id === instanceId ? { ...a, status, suspensionReason } : a,
  );
  _fleetData.active   = _fleetData.fleet.filter((a) => a.status === 'active').length;
  _fleetData.suspended = _fleetData.fleet.filter((a) => a.status === 'suspended').length;
  _fleetData.offline  = _fleetData.fleet.filter((a) => a.status === 'offline').length;
  renderFleet(_fleetData);
}

// Called from main dashboard JS when an SSE agent_update event arrives.
// Updates the matching card's heartbeat time without a full re-fetch.
export function handleAgentUpdateEvent(event) {
  const instanceId = event?.data?.instance_id ?? event?.instance_id;
  if (!instanceId || !_fleetData) return;
  const agent = _fleetData.fleet.find((a) => a.id === instanceId);
  if (!agent) return;
  agent.secondsAgo = 0;
  if (agent.status !== 'suspended') agent.status = 'active';
  const card = document.getElementById(`fleet-card-${instanceId}`);
  if (!card) return;
  const hbEl = card.querySelector('.fleet-card-hb');
  if (hbEl) hbEl.textContent = 'Heartbeat: just now';
  card.className = `fleet-card status-${agent.status}`;
}
```

## Step 5: Wire into the main dashboard JS

In the main dashboard JS (whatever file handles tab switching and periodic refresh):

1. **Fetch fleet data when the Fleet tab is activated** (not on every page load - it is its own panel):
   ```javascript
   import { renderFleet, handleAgentUpdateEvent } from './widgets/fleet.js';

   async function loadFleet() {
     try {
       const res = await fetch('/api/dashboard/fleet');
       if (!res.ok) return;
       renderFleet(await res.json());
     } catch { /* silent fail */ }
   }

   // In tab-switch handler:
   if (tab === 'fleet') loadFleet();

   // Refresh every 30 seconds while fleet tab is active:
   setInterval(() => {
     if (activeTab === 'fleet') loadFleet();
   }, 30_000);
   ```

2. **Route `agent_update` SSE events to the fleet widget** - find where `event.type === 'agent_update'` (or `event: 'agent_update'`) is handled in the SSE listener and add:
   ```javascript
   if (parsed.type === 'agent_update' || parsed.type === 'heartbeat') {
     handleAgentUpdateEvent(parsed.data ?? parsed);
   }
   ```

## What NOT to build

- Do not remove or modify the `instances-bar` chip row (line 725 in `dashboard.html`) - it serves a different purpose (quick instance switching context).
- Do not add a global kill switch button to the fleet tab - the global kill switch already exists in the Security tab.
- Do not add fleet data to the existing `GET /api/dashboard/posture` or `agent-status` endpoints - keep them separate so the fleet tab can refresh independently.
- Do not add server-side rendering - the Scout dashboard is a single static HTML file with client-side fetch. Follow the existing pattern.

## Test after building

```bash
cd console.labyrinthscout.com
pnpm vitest run src/dashboard/widgets/__tests__/fleet-summary.test.ts
pnpm test
pnpm build
pnpm dev
# Open http://localhost:4444/dashboard.html
# Click the Fleet tab
# Verify: cards render, heartbeat times update on SSE events,
#         Kill button requires a reason and updates the card to suspended,
#         Resume button updates card to active
# Register two agents and verify both appear as separate cards
```
