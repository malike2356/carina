# Prompt 19 - Quarantine Tool

Temporarily quarantine a named tool across a Carina instance. An operator selects a tool in
the Scout dashboard, Scout writes a Redis TTL key and publishes a control message, and
Carina's tool-runner silently short-circuits calls to that tool until the quarantine expires
or is lifted manually.

**Stack:** Node.js 22, TypeScript 5, Express 5, PostgreSQL 16, Redis 7 (ioredis). No PHP.

**Scout source root:** `console.labyrinthscout.com/src/`
**Carina source root:** `core.carinaai.uk/src/`

Existing infrastructure in place:
- `src/redis.ts` - `getRedis()` (shared client), `createSubscriber()` (dedicated subscriber)
- `src/db.ts` - `pool` for PostgreSQL queries
- `src/middleware/auth.ts` - `requireApiKey`
- `src/lib/instance-control.ts` - `publishControlMessage(payload)` publishes to `labyrinth:control`
- `src/lib/constants.ts` - `CONTROL_CHANNEL = 'labyrinth:control'`
- `src/api/sse.ts` - `broadcastEvent()`, `refreshAndBroadcastStats()`
- `src/server.ts` - mounts all routers
- `src/types.ts` - `SecurityEventRow`, `Severity`
- Carina `src/security/kill-switch-listener.ts` - handles `action:'suspend'`, `action:'resume'`, `action:'block_session'`; extend here
- Carina `src/agents/tool-runner.ts` - `executeToolCall()` at `src/agents/tool-runner.ts` line 26; checks `checkNotSuspended()` and then `enforceToolPolicy()` before execution

---

## Valid tool names

These are the only recognised tool names. Reject any other value at the API layer.

```typescript
const VALID_TOOLS = new Set([
  'web-search',
  'file-read',
  'file-write',
  'shell-exec',
  'http-request',
  'email-send',
  'code-exec',
]);
```

---

## 1. Scout: new file `src/api/quarantine.ts`

Three endpoints on a single router. Mount at `/api/quarantine`.

### POST /api/quarantine/tools

Body: `{ tool: string, instance_id: string, duration_minutes?: number, reason: string }`

Steps:

1. Validate body: `tool` must be in `VALID_TOOLS`. `instance_id` must be a non-empty string
   matching `/^[a-z0-9_-]+$/` up to 64 chars. `reason` must be a non-empty string up to 500
   chars. `duration_minutes` defaults to 60 if absent; clamp to 1-1440 (24 hours).
2. Compute TTL: `durationSeconds = durationMinutes * 60`.
3. Set Redis key: `SET scout:quarantine:{instance_id}:{tool} {reason} EX {durationSeconds}`.
4. Publish control message via `publishControlMessage`:
   ```json
   {
     "action": "quarantine_tool",
     "tool": "<tool>",
     "instance_id": "<instance_id>",
     "reason": "<reason>",
     "duration_minutes": <durationMinutes>,
     "timestamp": "<ISO 8601>"
   }
   ```
5. Insert security event (`severity:'warning'`, `event_type:'tool_quarantined'`,
   `source:'scout-api'`, `description:'Tool quarantined by operator: {tool}'`,
   `instance_id`, `metadata:{ tool, reason, duration_minutes }`).
   Broadcast via `broadcastEvent()` and call `refreshAndBroadcastStats()`.
6. Compute `expires_at = new Date(Date.now() + durationSeconds * 1000).toISOString()`.
7. Return `{ ok: true, tool, instance_id, expires_at }`.

### GET /api/quarantine/tools?instance_id=xxx

1. Require `instance_id` query param (same validation as above).
2. Scan Redis keys: `KEYS scout:quarantine:{instance_id}:*`. For each key, call `TTL` to get
   remaining seconds and `GET` to retrieve the stored reason.
3. Return `{ quarantined: Array<{ tool: string, reason: string, ttl_seconds: number }> }`.

Note: use `KEYS` only because operator dashboards have low call frequency. If this endpoint
is called at high volume in the future, replace with `SCAN`.

### DELETE /api/quarantine/tools/:tool?instance_id=xxx

1. Validate `tool` and `instance_id` as above.
2. `DEL scout:quarantine:{instance_id}:{tool}` in Redis.
3. Publish control message: `{ action:'lift_quarantine', tool, instance_id, timestamp }`.
4. Insert security event (`severity:'info'`, `event_type:'tool_quarantine_lifted'`,
   `source:'scout-api'`, `description:'Quarantine lifted by operator: {tool}'`).
5. Return `{ ok: true, tool, instance_id, status: 'active' }`.

Full file skeleton:

```typescript
import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';
import { getRedis } from '../redis.js';
import { publishControlMessage } from '../lib/instance-control.js';
import { broadcastEvent, refreshAndBroadcastStats } from '../api/sse.js';
import type { SecurityEventRow } from '../types.js';

export const quarantineRouter: IRouter = Router();

const VALID_TOOLS = new Set([
  'web-search', 'file-read', 'file-write',
  'shell-exec', 'http-request', 'email-send', 'code-exec',
]);

const DEFAULT_DURATION_MINUTES = 60;
const MAX_DURATION_MINUTES = 1440;

function validateInstanceId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-z0-9_-]+$/.test(id) && id.length <= 64;
}

function validateTool(tool: unknown): tool is string {
  return typeof tool === 'string' && VALID_TOOLS.has(tool);
}

function quarantineKey(instanceId: string, tool: string): string {
  return `scout:quarantine:${instanceId}:${tool}`;
}

async function insertQuarantineEvent(
  severity: 'info' | 'warning',
  eventType: string,
  description: string,
  instanceId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const result = await pool.query<SecurityEventRow>(
    `INSERT INTO security_events
       (severity, source, event_type, description, metadata, instance_id)
     VALUES ($1, 'scout-api', $2, $3, $4, $5)
     RETURNING *`,
    [severity, eventType, description, JSON.stringify(metadata), instanceId],
  );
  const inserted = result.rows[0];
  if (!inserted) return;
  const event: SecurityEventRow = {
    ...inserted,
    metadata: typeof inserted.metadata === 'object' && inserted.metadata !== null
      ? (inserted.metadata as Record<string, unknown>)
      : {},
    created_at: new Date(inserted.created_at).toISOString(),
  };
  broadcastEvent(event);
  void refreshAndBroadcastStats();
}

// POST handler, GET handler, DELETE handler implemented here per spec above.
```

---

## 2. Scout: mount in `src/server.ts`

Add import:

```typescript
import { quarantineRouter } from './api/quarantine.js';
```

Mount after the `/api/sessions` line added in prompt 18:

```typescript
app.use('/api/quarantine', requireApiKey, quarantineRouter);
```

---

## 3. Carina: extend `src/security/kill-switch-listener.ts`

The module already handles `block_session`. Now add in-memory quarantine state.

Add after the `blockedSessions` set declaration:

```typescript
// instance_id -> Set of quarantined tool names
const quarantinedTools = new Map<string, Set<string>>();
```

Inside `applyControlPayload()`, add two new branches after `block_session`:

```typescript
} else if (payload.action === 'quarantine_tool') {
  const tool = payload.tool;
  const iid = typeof payload.instance_id === 'string' ? payload.instance_id : '';
  if (typeof tool === 'string' && tool && iid) {
    if (!quarantinedTools.has(iid)) quarantinedTools.set(iid, new Set());
    quarantinedTools.get(iid)!.add(tool);
    const logLine = `TOOL QUARANTINED: ${tool} on ${iid}. Reason: ${String(payload.reason ?? '')}`;
    console.warn(`[KillSwitch] ${logLine}`);
    appendLog(logLine);
  }
} else if (payload.action === 'lift_quarantine') {
  const tool = payload.tool;
  const iid = typeof payload.instance_id === 'string' ? payload.instance_id : '';
  if (typeof tool === 'string' && tool && iid) {
    quarantinedTools.get(iid)?.delete(tool);
    const logLine = `TOOL QUARANTINE LIFTED: ${tool} on ${iid}`;
    console.log(`[KillSwitch] ${logLine}`);
    appendLog(logLine);
  }
}
```

Add new export:

```typescript
export function isToolQuarantined(instanceId: string, toolName: string): boolean {
  return quarantinedTools.get(instanceId)?.has(toolName) ?? false;
}
```

Add test helper:

```typescript
export function _clearQuarantinedTools(): void {
  quarantinedTools.clear();
}
```

Export `isToolQuarantined` from `src/security/index.ts`:

```typescript
export {
  initKillSwitchListener,
  checkNotSuspended,
  isSuspended,
  isSessionBlocked,
  isToolQuarantined,   // add this
} from './kill-switch-listener.js';
```

---

## 4. Carina: modify `src/agents/tool-runner.ts`

Add the import at the top of the file alongside the existing security imports:

```typescript
import { isToolQuarantined } from '../security/index.js';
```

In `executeToolCall()`, after the `checkNotSuspended()` call (around line 33-34), and
before the `registry.get(call.toolName)` lookup, add:

```typescript
if (process.env.LABYRINTH_ENABLED === 'true') {
  const instanceId =
    process.env.SCOUT_INSTANCE_ID ??
    process.env.LABYRINTH_INSTANCE_ID ??
    'carina-local';
  if (isToolQuarantined(instanceId, call.toolName)) {
    return {
      error: `Tool "${call.toolName}" is temporarily quarantined by security policy. Try again later or contact your administrator.`,
    };
  }
}
```

This returns early without touching Redis, network, or filesystem. The calling agent receives
the error string as a tool result and can relay it to the user.

---

## 5. Dashboard: `public/dashboard.html`

### 5a. CSS - add inside the `<style>` block near `.btn-kill`:

```css
/* Quarantine tool panel in the instances bar */
.quarantine-panel {
  display: none;
  position: absolute;
  top: 38px;
  left: 0;
  right: 0;
  background: var(--navy);
  border: 1px solid var(--border);
  border-top: none;
  border-radius: 0 0 4px 4px;
  padding: .4rem .65rem;
  z-index: 500;
  gap: .3rem;
  flex-wrap: wrap;
  align-items: center;
}
.quarantine-panel.open { display: flex; }
.btn-quarantine-toggle {
  background: transparent;
  border: 1px solid rgba(155,89,255,.3);
  color: var(--purple);
  font-family: 'JetBrains Mono', monospace;
  font-size: .52rem;
  padding: .06rem .35rem;
  border-radius: 2px;
  cursor: pointer;
  letter-spacing: .06em;
}
.btn-tool-quarantine {
  background: rgba(155,89,255,.1);
  border: 1px solid rgba(155,89,255,.3);
  color: var(--purple);
  font-family: 'JetBrains Mono', monospace;
  font-size: .55rem;
  padding: .08rem .4rem;
  border-radius: 2px;
  cursor: pointer;
}
.btn-tool-quarantine.active {
  background: rgba(155,89,255,.3);
  border-color: var(--purple);
}
.quarantine-lbl {
  font-family: 'JetBrains Mono', monospace;
  font-size: .58rem;
  color: var(--text);
  margin-right: .3rem;
}
```

### 5b. JavaScript - quarantine panel and polling

Add near the top of the inline script, with the other constants:

```javascript
const TOOL_NAMES = [
  'shell-exec', 'code-exec', 'file-write', 'http-request',
  'email-send', 'web-search', 'file-read',
];
```

Add the panel-building function:

```javascript
function buildQuarantinePanel(instanceId) {
  const panel = document.createElement('div');
  panel.className = 'quarantine-panel';
  panel.id = `qpanel-${instanceId}`;

  const lbl = document.createElement('span');
  lbl.className = 'quarantine-lbl';
  lbl.textContent = 'QUARANTINE:';
  panel.appendChild(lbl);

  for (const tool of TOOL_NAMES) {
    const btn = document.createElement('button');
    btn.className = 'btn-tool-quarantine';
    btn.id = `qtool-${instanceId}-${tool}`;
    btn.textContent = tool;
    btn.title = `Quarantine ${tool} for 60 minutes`;
    btn.onclick = () => void quarantineTool(tool, instanceId, btn);
    panel.appendChild(btn);
  }
  return panel;
}

async function quarantineTool(tool, instanceId, btn) {
  const isActive = btn.classList.contains('active');
  if (isActive) {
    // Lift quarantine.
    try {
      const r = await fetch(
        `/api/quarantine/tools/${encodeURIComponent(tool)}?instance_id=${encodeURIComponent(instanceId)}`,
        { method: 'DELETE', headers: H() },
      );
      const d = await r.json();
      if (d.ok) {
        btn.classList.remove('active');
        toast(`Quarantine lifted: ${tool}`, 'info');
      } else {
        toast('Lift failed: ' + (d.error || ''), 'critical');
      }
    } catch {
      toast('Lift request failed (network error)', 'critical');
    }
  } else {
    // Apply quarantine.
    try {
      const r = await fetch('/api/quarantine/tools', {
        method: 'POST',
        headers: H(),
        body: JSON.stringify({
          tool,
          instance_id: instanceId,
          duration_minutes: 60,
          reason: 'Operator quarantine from dashboard',
        }),
      });
      const d = await r.json();
      if (d.ok) {
        btn.classList.add('active');
        toast(`Quarantined: ${tool} (60 min)`, 'warning');
      } else {
        toast('Quarantine failed: ' + (d.error || ''), 'critical');
      }
    } catch {
      toast('Quarantine request failed (network error)', 'critical');
    }
  }
}

async function refreshQuarantinePanel(instanceId) {
  const redis = getRedis();  // This runs in the dashboard JS context.
  // Poll the GET endpoint.
  try {
    const r = await fetch(
      `/api/quarantine/tools?instance_id=${encodeURIComponent(instanceId)}`,
      { headers: H() },
    );
    const d = await r.json();
    if (!d.quarantined) return;
    const active = new Set(d.quarantined.map((q) => q.tool));
    for (const tool of TOOL_NAMES) {
      const btn = document.getElementById(`qtool-${instanceId}-${tool}`);
      if (!btn) continue;
      btn.classList.toggle('active', active.has(tool));
      const entry = d.quarantined.find((q) => q.tool === tool);
      if (entry) {
        btn.title = `Quarantined: ${entry.reason} (${entry.ttl_seconds}s remaining). Click to lift.`;
      } else {
        btn.title = `Quarantine ${tool} for 60 minutes`;
      }
    }
  } catch {
    // Polling failure is non-fatal.
  }
}
```

Add a polling interval at the end of the script init block (alongside existing polling):

```javascript
setInterval(() => {
  for (const instanceId of activeInstanceIds) {
    void refreshQuarantinePanel(instanceId);
  }
}, 30_000);
```

Where `activeInstanceIds` is a `Set<string>` you maintain by collecting IDs from the
instances bar render loop. If that variable does not exist yet, create it as a module-level
`const activeInstanceIds = new Set()` and populate it when instance chips are rendered.

Attach the quarantine toggle button to each instance chip in `renderInstances()`:

```javascript
const toggleBtn = document.createElement('button');
toggleBtn.className = 'btn-quarantine-toggle';
toggleBtn.textContent = 'TOOLS';
toggleBtn.title = 'Toggle tool quarantine panel';
toggleBtn.onclick = () => {
  const panel = document.getElementById(`qpanel-${inst.id}`);
  if (panel) panel.classList.toggle('open');
};
chip.appendChild(toggleBtn);

const panel = buildQuarantinePanel(inst.id);
chip.appendChild(panel);
```

---

## Test cases

Write tests in `src/api/__tests__/quarantine.test.ts`.

**Test 1 - quarantine tool:**
`POST /api/quarantine/tools` with `{ tool:'shell-exec', instance_id:'carina-local', reason:'test', duration_minutes:30 }`.
Expect 200, body `{ ok:true, tool:'shell-exec', instance_id:'carina-local', expires_at: <ISO> }`.
Expect Redis key `scout:quarantine:carina-local:shell-exec` exists with TTL ~1800.
Expect `publishControlMessage` called with `action:'quarantine_tool'`.

**Test 2 - invalid tool name:**
`POST /api/quarantine/tools` with `{ tool:'rm-rf', instance_id:'carina-local', reason:'x' }`.
Expect 400 `{ error: ... }`.

**Test 3 - Carina receives quarantine_tool message:**
Call `_processControlMessage(JSON.stringify({ action:'quarantine_tool', tool:'shell-exec', instance_id:'carina-local', reason:'test' }))`.
Expect `isToolQuarantined('carina-local', 'shell-exec')` to be `true`.
Expect `isToolQuarantined('carina-local', 'file-read')` to be `false`.

**Test 4 - lift quarantine via DELETE:**
After test 3, call `_processControlMessage(JSON.stringify({ action:'lift_quarantine', tool:'shell-exec', instance_id:'carina-local' }))`.
Expect `isToolQuarantined('carina-local', 'shell-exec')` to be `false`.

**Test 5 - GET lists active quarantines with TTL:**
After quarantining `shell-exec`, `GET /api/quarantine/tools?instance_id=carina-local`.
Expect response contains `{ tool:'shell-exec', ttl_seconds: <number > 0>, reason:'test' }`.

**Test 6 - expired quarantine not listed:**
Set Redis TTL to 1 second. Wait 1100ms. `GET /api/quarantine/tools`.
Expect empty `quarantined` array.

---

## Coding standards

- All DB queries use parameterised placeholders. No string concatenation.
- All async Express handlers wrapped in try/catch; return 500 on unexpected errors.
- TypeScript strict mode. Use `unknown` and narrow with type guards; avoid `any`.
- Redis key format: `scout:quarantine:{instance_id}:{tool}` - document this as a constant string template in the file.
- `publishControlMessage` already handles Redis unavailability; no extra guard needed.
- Functions under 20 lines; extract helpers when handlers grow beyond that.
- The `KEYS` command in `GET` is acceptable given expected call frequency; add a comment noting it should be replaced with `SCAN` for high-throughput deployments.
- Quarantine state in Carina is in-memory only. If Carina restarts it subscribes again and Scout will not replay old messages. Operators must re-quarantine if needed after a Carina restart. Document this in a comment near the `quarantinedTools` Map.
