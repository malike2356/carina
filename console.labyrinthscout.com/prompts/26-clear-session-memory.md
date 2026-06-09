# Labyrinth Scout - Prompt 26: Clear Session Memory (Dashboard Action)

## Context

Labyrinth Scout is a Node.js/TypeScript security control plane monitoring Carina AI agent
instances. Scout runs at port 4444. This prompt adds an operator action to wipe all episodic
memory for a specific agent session - useful when a session is compromised or behaving
unexpectedly and must be cleanly reset without a full restart.

**Project root:** `/opt/lampp/htdocs/VERLOX/Carina-ai/`
**Scout source:** `console.labyrinthscout.com/src/`
**Carina source:** `core.carinaai.uk/src/`
**Dashboard:** `console.labyrinthscout.com/public/dashboard.html`
**Stack:** Node.js 22, TypeScript 5, Express 5, PostgreSQL 16, Redis 7 (ioredis). No PHP.

Scout and Carina share the same PostgreSQL database. The `episodic_memories` table belongs to
Carina but Scout has direct pool access and can DELETE rows. Redis pub/sub is used to
synchronise the in-process memory cache Carina may hold.

**Files that already exist and must not be recreated:**
- `core.carinaai.uk/src/memory/store.ts` - exports `clearSession(sessionId: string): Promise<void>`
  which runs `DELETE FROM episodic_memories WHERE session_id = $1`
- `core.carinaai.uk/src/security/kill-switch-listener.ts` - listens on `labyrinth:control`,
  handles `suspend` and `resume` actions; `applyControlPayload` is the dispatch function
- `src/db.ts` - exports `pool` (shared pg.Pool)
- `src/redis.ts` - exports `getRedis()`, `createSubscriber()`
- `src/middleware/auth.ts` - exports `requireApiKey`
- `src/server.ts` - Express app

---

## What to Build

### 1. New file: `src/api/memory-control.ts`

Full implementation. No stubs.

```typescript
import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';
import { getRedis } from '../redis.js';

export const memoryControlRouter: IRouter = Router();

interface SessionRow {
  session_id: string;
  turn_count: string;
  last_active: string;
}

// POST /api/memory/clear-session
// Body: { session_id: string, instance_id: string, reason: string }
// Returns: { ok: true, session_id, rows_deleted: number }
memoryControlRouter.post('/clear-session', async (req: Request, res: Response): Promise<void> => {
  const body      = req.body as Record<string, unknown>;
  const sessionId  = typeof body.session_id  === 'string' ? body.session_id.trim()  : '';
  const instanceId = typeof body.instance_id === 'string' ? body.instance_id.trim() : '';
  const reason     = typeof body.reason === 'string' ? body.reason.trim() : '';

  if (!sessionId)  { res.status(400).json({ error: 'session_id is required' }); return; }
  if (!instanceId) { res.status(400).json({ error: 'instance_id is required' }); return; }
  if (!reason)     { res.status(400).json({ error: 'reason is required' }); return; }

  try {
    // 1. Delete directly from the shared DB (immediate effect even if Redis is slow)
    const del = await pool.query(
      'DELETE FROM episodic_memories WHERE session_id = $1',
      [sessionId],
    );
    const rowsDeleted = del.rowCount ?? 0;

    // 2. Publish Redis control message so Carina clears any in-process cache
    const redis = getRedis();
    if (redis) {
      await redis.publish(
        'labyrinth:control',
        JSON.stringify({
          action: 'clear_session_memory',
          session_id: sessionId,
          instance_id: instanceId,
          reason,
        }),
      );
    }

    // 3. Log security event
    await pool.query(
      `INSERT INTO security_events
         (instance_id, event_type, severity, source, description, metadata, session_id)
       VALUES ($1, 'session_memory_cleared', 'warning', 'memory-control-api', $2, $3, $4)`,
      [
        instanceId,
        `Session memory cleared by operator: ${reason}`,
        JSON.stringify({ rows_deleted: rowsDeleted, reason, session_id: sessionId }),
        sessionId,
      ],
    );

    res.json({ ok: true, session_id: sessionId, rows_deleted: rowsDeleted });
  } catch (err) {
    console.error('[memory-control] clear-session error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/memory/sessions?instance_id=xxx
// Returns list of distinct sessions from episodic_memories for awareness.
// instance_id is accepted for consistency but episodic_memories has no instance_id column -
// we return all sessions and let the dashboard filter by known instance.
memoryControlRouter.get('/sessions', async (req: Request, res: Response): Promise<void> => {
  // instance_id param is accepted but episodic_memories is not partitioned by instance.
  // Return global list. Operators see all sessions, which is intentional for the security view.
  try {
    const result = await pool.query<SessionRow>(
      `SELECT session_id,
              COUNT(*)::text         AS turn_count,
              MAX(created_at)::text  AS last_active
       FROM episodic_memories
       GROUP BY session_id
       ORDER BY MAX(created_at) DESC
       LIMIT 50`,
    );

    const sessions = result.rows.map((r) => ({
      session_id:  r.session_id,
      turn_count:  parseInt(r.turn_count, 10),
      last_active: r.last_active,
    }));

    res.json({ sessions });
  } catch (err) {
    console.error('[memory-control] sessions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### 2. Mount the router in `src/server.ts`

Add import and mount alongside the other routers:

```typescript
// import (at top with other imports)
import { memoryControlRouter } from './api/memory-control.js';

// mount (alongside other app.use calls)
app.use('/api/memory', requireApiKey, memoryControlRouter);
```

### 3. Modify `core.carinaai.uk/src/security/kill-switch-listener.ts`

Handle `clear_session_memory` action. The `clearSession` function from
`src/memory/store.ts` already performs the DB delete; call it here to flush any in-process
context the running agent may hold.

Add import at the top of the file (alongside the existing imports):

```typescript
import { clearSession } from '../memory/store.js';
```

In the existing `applyControlPayload` function, add a new branch at the end of the
`if / else if` chain for suspend/resume (do not modify those existing branches):

```typescript
  } else if (payload.action === 'clear_session_memory') {
    const sid = payload.session_id;
    if (typeof sid === 'string' && sid.length > 0) {
      clearSession(sid).then(() => {
        console.log(`[KillSwitch] Session memory cleared: ${sid.slice(0, 8)}...`);
      }).catch((err: unknown) => {
        console.error('[KillSwitch] clearSession failed:', err);
      });
    }
  }
```

Note: `clearSession` is async. Calling it inside the synchronous Redis message handler with
`.then().catch()` is correct - the handler must return synchronously, and we do not need to
await the result to process the next message.

### 4. Update `public/dashboard.html`

#### 4a. Add the memory modal HTML

Place this block immediately after the honeypot modal added in prompt 24 (or after the kill
modal if prompt 24 has not been applied yet):

```html
<!-- MEMORY MODAL -->
<div id="memory-overlay" hidden style="position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:1500;display:flex;align-items:center;justify-content:center">
  <div style="background:#0d1826;border:1px solid #e6c07b;border-radius:6px;padding:1.5rem 2rem;min-width:400px;max-width:560px;font-family:'JetBrains Mono',monospace">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem">
      <h3 style="color:#e6c07b;font-size:.85rem;margin:0">SESSION MEMORY</h3>
      <button onclick="closeMemoryModal()" style="background:none;border:none;color:rgba(139,175,192,.5);font-size:.9rem;cursor:pointer;padding:0 .25rem">x</button>
    </div>
    <p style="color:rgba(139,175,192,.6);font-size:.62rem;margin:0 0 .75rem;line-height:1.5">
      Active agent sessions and their episodic memory turn counts.<br>
      Clearing memory resets the session context. Use alongside KILL for compromised sessions.
    </p>
    <div id="memory-modal-body" style="max-height:300px;overflow-y:auto;display:flex;flex-direction:column;gap:.3rem">
      <span style="color:rgba(139,175,192,.4);font-size:.62rem">Loading sessions...</span>
    </div>
    <div style="margin-top:.75rem;border-top:1px solid rgba(139,175,192,.15);padding-top:.6rem;display:flex;justify-content:flex-end">
      <button onclick="closeMemoryModal()" style="background:none;border:1px solid rgba(139,175,192,.3);color:rgba(139,175,192,.6);border-radius:3px;padding:.3rem .8rem;font-family:'JetBrains Mono',monospace;font-size:.65rem;cursor:pointer">CLOSE</button>
    </div>
  </div>
</div>
```

Add these CSS rules inside the existing `<style>` block:

```css
.sess-row{display:flex;align-items:center;gap:.6rem;padding:.3rem .4rem;border:1px solid rgba(139,175,192,.1);border-radius:3px;font-size:.62rem}
.sess-row:hover{background:rgba(139,175,192,.04)}
.sess-id{color:#8bc;font-family:'JetBrains Mono',monospace;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sess-count{color:rgba(139,175,192,.6);min-width:4.5rem;text-align:right}
.sess-age{color:rgba(139,175,192,.4);min-width:5rem;text-align:right}
.btn-clear-mem{background:none;border:1px solid rgba(230,192,123,.4);color:#e6c07b;border-radius:3px;padding:.2rem .55rem;font-family:'JetBrains Mono',monospace;font-size:.6rem;cursor:pointer;flex-shrink:0}
.btn-clear-mem:hover{background:rgba(230,192,123,.08)}
```

#### 4b. Add a MEMORY button to the instances bar

In the `updateInstances()` function, after the existing HONEYPOT chip (if prompt 24 applied)
or at the end of the instances bar rendering, append a MEMORY button:

```javascript
// Memory button in instances bar
const memBtn = document.createElement('button');
memBtn.style.cssText = 'background:none;border:1px solid rgba(230,192,123,.35);color:#e6c07b;border-radius:3px;padding:.2rem .6rem;font-family:"JetBrains Mono",monospace;font-size:.62rem;cursor:pointer;flex-shrink:0';
memBtn.textContent = 'MEMORY';
memBtn.title = 'View and clear session memory';
memBtn.onclick = openMemoryModal;
bar.appendChild(memBtn);
```

#### 4c. Add a CLEAR MEMORY button alongside KILL in event rows

In the event row builder, inside the block that handles `ev.session_id`, add a CLEAR MEM
button next to any existing BLOCK or THROTTLE buttons:

```javascript
if (ev.session_id) {
  const cmBtn = document.createElement('button');
  cmBtn.className = 'btn-action';
  cmBtn.style.cssText = 'border-color:rgba(230,192,123,.5);color:#e6c07b';
  cmBtn.textContent = 'CLEAR MEM';
  cmBtn.title = 'Wipe episodic memory for this session';
  cmBtn.onclick = () => confirmClearMemory(ev.session_id, ev.instance_id || 'carina-local');
  actions.appendChild(cmBtn);
}
```

#### 4d. Add memory modal functions to the `<script>` block

Add alongside the existing kill/resume/honeypot functions:

```javascript
function openMemoryModal() {
  document.getElementById('memory-overlay').hidden = false;
  void loadSessionMemory();
}

function closeMemoryModal() {
  document.getElementById('memory-overlay').hidden = true;
}

function formatAge(isoStr) {
  if (!isoStr) return 'unknown';
  const secs = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (secs < 60)   return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs/60)}m ago`;
  return `${Math.floor(secs/3600)}h ago`;
}

async function loadSessionMemory() {
  const instId = (instances.find(i => i.status === 'active') || {}).id || 'carina-local';
  const d = await API(`/api/memory/sessions?instance_id=${encodeURIComponent(instId)}`);
  const body = document.getElementById('memory-modal-body');
  if (!d || !d.sessions) {
    body.innerHTML = '<span style="color:#e06c75;font-size:.62rem">Failed to load sessions</span>';
    return;
  }
  if (d.sessions.length === 0) {
    body.innerHTML = '<span style="color:rgba(139,175,192,.4);font-size:.62rem">No sessions with stored memory</span>';
    return;
  }
  renderSessionList(d.sessions, instId);
}

function renderSessionList(sessions, instanceId) {
  const body = document.getElementById('memory-modal-body');
  body.innerHTML = sessions.map(s => `
    <div class="sess-row">
      <span class="sess-id" title="${s.session_id}">${s.session_id.slice(0,16)}...</span>
      <span class="sess-count">${s.turn_count} turn${s.turn_count !== 1 ? 's' : ''}</span>
      <span class="sess-age">${formatAge(s.last_active)}</span>
      <button class="btn-clear-mem"
              onclick="confirmClearMemory('${s.session_id}','${instanceId}')">CLEAR</button>
    </div>
  `).join('');
}

function confirmClearMemory(sessionId, instanceId) {
  if (!confirm(`Clear all memory for session ${sessionId.slice(0,12)}...?\nThis cannot be undone.`)) return;
  void clearSessionMemory(sessionId, instanceId);
}

async function clearSessionMemory(sessionId, instanceId) {
  try {
    const r = await fetch('/api/memory/clear-session', {
      method: 'POST',
      headers: H(),
      body: JSON.stringify({
        session_id: sessionId,
        instance_id: instanceId,
        reason: 'Operator clear from dashboard',
      }),
    });
    const d = await r.json();
    if (d.ok) {
      toast(`Memory cleared: ${d.rows_deleted} turn${d.rows_deleted !== 1 ? 's' : ''} deleted`, 'ok');
      void loadSessionMemory();
    } else {
      toast('Clear failed: ' + (d.error || 'unknown'), 'critical');
    }
  } catch {
    toast('Clear request failed', 'critical');
  }
}
```

---

## Test Cases

1. `POST /api/memory/clear-session` with `{ session_id:'abc123', instance_id:'carina-local', reason:'test' }`
   - Rows with `session_id='abc123'` deleted from `episodic_memories`
   - Response: `{ ok: true, session_id:'abc123', rows_deleted: N }`
   - `security_events` row with `event_type='session_memory_cleared'` and `severity='warning'`
   - Redis message published on `labyrinth:control` with `action:'clear_session_memory'`

2. Carina receives the Redis message
   - `applyControlPayload` calls `clearSession('abc123')`
   - Next call to `getSessionHistory('abc123', ...)` returns empty array
   - Agent turn for that session starts with no injected past context

3. `GET /api/memory/sessions?instance_id=carina-local`
   - Response: `{ sessions: [{ session_id, turn_count, last_active }, ...] }`
   - Ordered by `last_active DESC`, max 50 rows
   - After clearing, the cleared session does not appear (no rows remain)

4. Dashboard MEMORY button in instances bar opens modal
   - Modal shows session list with turn counts and age
   - CLEAR button on each row triggers confirmation dialog
   - After confirmation, `clearSessionMemory()` is called and modal refreshes

5. Event stream row with `session_id` shows CLEAR MEM button in amber
   - Clicking confirms then calls `/api/memory/clear-session`
   - Toast confirms rows deleted

6. Other sessions are entirely unaffected by clearing `abc123`
   - `GET /api/memory/sessions` still shows them with correct turn counts
   - Their episodic memory is intact

7. Calling `POST /api/memory/clear-session` when the session has no rows
   - Response: `{ ok: true, session_id, rows_deleted: 0 }`
   - No error; the operation is idempotent
