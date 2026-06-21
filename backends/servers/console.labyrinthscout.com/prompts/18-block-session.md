# Prompt 18 - Block Session

Block an individual Carina session by ID. An operator clicks a button in the Scout dashboard,
Scout writes the session to PostgreSQL and publishes a Redis control message, and Carina's
kill-switch listener intercepts every subsequent `turn()` call for that session.

**Stack:** Node.js 22, TypeScript 5, Express 5, PostgreSQL 16, Redis 7 (ioredis). No PHP.

**Scout source root:** `console.labyrinthscout.com/src/`
**Carina source root:** `core.carinaai.uk/src/`

All existing infrastructure is in place:
- `src/db.ts` - `pool` (pg.Pool), `initDb()` runs migrations via `src/migrations.ts`
- `src/redis.ts` - `getRedis()` returns shared ioredis client; `createSubscriber()` for dedicated subscriber connections
- `src/middleware/auth.ts` - `requireApiKey` checks `X-Scout-Key` header
- `src/api/sse.ts` - `broadcastEvent(event: SecurityEventRow)` and `broadcastStats()`
- `src/lib/instance-control.ts` - `publishControlMessage(payload)` wraps `getRedis().publish('labyrinth:control', ...)`
- `src/lib/constants.ts` - `CONTROL_CHANNEL = 'labyrinth:control'`
- `src/server.ts` - mounts all routers; add new router here
- `src/types.ts` - `SecurityEventRow`, `Severity`
- Carina `src/security/kill-switch-listener.ts` - already handles `action:'suspend'` and `action:'resume'`; extend it here
- Carina `src/agents/tool-runner.ts` - calls `checkNotSuspended()` at line 33; add session check after it
- Carina `src/agents/carina.ts` - `CarinaAgent` class; `this.sessionId` is set in constructor

---

## 1. Scout: new migration in `src/migrations.ts`

Inside `runMigrations()`, after the existing `CREATE TABLE IF NOT EXISTS honeypots` block, add:

```typescript
await client.query(`
  CREATE TABLE IF NOT EXISTS blocked_sessions (
    session_id TEXT PRIMARY KEY,
    reason     TEXT NOT NULL,
    blocked_by TEXT NOT NULL DEFAULT 'operator',
    blocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`);

await client.query(`
  CREATE INDEX IF NOT EXISTS idx_blocked_sessions_blocked_at
    ON blocked_sessions (blocked_at DESC)
`);
```

No other migration changes.

---

## 2. Scout: new file `src/api/block-session.ts`

```typescript
import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';
import { publishControlMessage } from '../lib/instance-control.js';
import { broadcastEvent, refreshAndBroadcastStats } from '../api/sse.js';
import type { SecurityEventRow } from '../types.js';

export const blockSessionRouter: IRouter = Router({ mergeParams: true });

function validateBody(body: unknown): { ok: true; reason: string; instance_id: string | null } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Body must be a JSON object' };
  }
  const b = body as Record<string, unknown>;
  if (typeof b.reason !== 'string' || !b.reason.trim() || b.reason.length > 500) {
    return { ok: false, error: 'reason must be a non-empty string up to 500 chars' };
  }
  const instance_id = typeof b.instance_id === 'string' ? b.instance_id : null;
  return { ok: true, reason: b.reason.trim(), instance_id };
}

blockSessionRouter.post('/:sessionId/block', async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = req.params.sessionId;
    if (!sessionId || typeof sessionId !== 'string' || sessionId.length > 256) {
      res.status(400).json({ error: 'Valid session_id is required' });
      return;
    }

    const validated = validateBody(req.body);
    if (!validated.ok) {
      res.status(400).json({ error: validated.error });
      return;
    }

    const { reason, instance_id } = validated;
    const instanceIdParam = instance_id ?? (typeof req.query.instance_id === 'string' ? req.query.instance_id : null);

    // Upsert into blocked_sessions (idempotent: re-blocking updates the reason).
    await pool.query(
      `INSERT INTO blocked_sessions (session_id, reason, blocked_by)
       VALUES ($1, $2, 'operator')
       ON CONFLICT (session_id) DO UPDATE
         SET reason = EXCLUDED.reason, blocked_at = NOW()`,
      [sessionId, reason],
    );

    // Record security event so it appears in the live stream.
    const evResult = await pool.query<SecurityEventRow>(
      `INSERT INTO security_events
         (severity, source, event_type, description, metadata, session_id, instance_id)
       VALUES ('critical', 'scout-api', 'session_blocked', $1, $2, $3, $4)
       RETURNING *`,
      [
        `Session blocked by operator: ${reason}`,
        JSON.stringify({ reason, blocked_by: 'operator' }),
        sessionId,
        instanceIdParam,
      ],
    );

    const inserted = evResult.rows[0];
    if (inserted) {
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

    // Tell Carina instances to block this session immediately.
    await publishControlMessage({
      action: 'block_session',
      session_id: sessionId,
      instance_id: instanceIdParam,
      reason,
      timestamp: new Date().toISOString(),
    });

    res.json({ ok: true, session_id: sessionId, status: 'blocked' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:block-session] Failed:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

---

## 3. Scout: mount in `src/server.ts`

Add the import next to the other router imports:

```typescript
import { blockSessionRouter } from './api/block-session.js';
```

Add the mount line after `app.use('/api/instances', requireApiKey, instancesRouter);`:

```typescript
app.use('/api/sessions', requireApiKey, blockSessionRouter);
```

The CORS middleware at the top already allows all origins and the `X-Scout-Key` header.
Add `'DELETE'` to the `Access-Control-Allow-Methods` value if it is not already present,
so the dashboard can lift blocks in the future without a CORS preflight failure:

```typescript
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
```

---

## 4. Carina: extend `src/security/kill-switch-listener.ts`

The module already maintains `suspended` (boolean) and handles `action:'suspend'` / `action:'resume'`.
Extend it to also maintain a `Set<string>` of blocked session IDs.

Add after the existing module-level state variables (lines 9-11):

```typescript
const blockedSessions = new Set<string>();
```

Inside `applyControlPayload()`, after the `else if (payload.action === 'resume')` branch, add:

```typescript
} else if (payload.action === 'block_session') {
  const sid = payload.session_id;
  if (typeof sid === 'string' && sid) {
    blockedSessions.add(sid);
    const logLine = `SESSION BLOCKED: ${sid}. Reason: ${String(payload.reason ?? '')}`;
    console.warn(`[KillSwitch] ${logLine}`);
    appendLog(logLine);
  }
}
```

Add a new export at the bottom of the module, alongside `isSuspended()`:

```typescript
export function isSessionBlocked(sessionId: string): boolean {
  return blockedSessions.has(sessionId);
}
```

Also add a test helper alongside `_resetSuspendedFlag()`:

```typescript
export function _clearBlockedSessions(): void {
  blockedSessions.clear();
}
```

Export `isSessionBlocked` from `src/security/index.ts` by adding it to the existing re-export line:

```typescript
export {
  initKillSwitchListener,
  checkNotSuspended,
  isSuspended,
  isSessionBlocked,        // add this
} from './kill-switch-listener.js';
```

---

## 5. Carina: extend `src/agents/carina.ts` `turn()` method

At the top of the file, add the import:

```typescript
import { isSessionBlocked } from '../security/index.js';
```

Inside `async *turn(userMessage: string)` (or whichever method drives a conversation turn),
add this guard at the very start of the method body, before any memory/LLM calls:

```typescript
if (process.env.LABYRINTH_ENABLED === 'true' && isSessionBlocked(this.sessionId)) {
  yield {
    type: 'text' as const,
    content: '[Session blocked by security policy. Start a new session to continue.]',
  };
  return;
}
```

This ensures zero LLM API spend for blocked sessions. The guard fires before `buildContext()`.

---

## 6. Dashboard: `public/dashboard.html`

### 6a. CSS - add inside the `<style>` block, near `.btn-kill` and `.btn-resume`:

```css
.btn-block-session {
  background: rgba(212,175,55,.1);
  border: 1px solid rgba(212,175,55,.35);
  color: var(--amber);
  font-family: 'JetBrains Mono', monospace;
  font-size: .52rem;
  padding: .06rem .35rem;
  border-radius: 2px;
  cursor: pointer;
  letter-spacing: .06em;
  opacity: 0;
  transition: opacity .15s;
  flex-shrink: 0;
}
.ev-row:hover .btn-block-session {
  opacity: 1;
}
```

### 6b. JavaScript - inside `appendEvent(ev)` (the function that builds `.ev-row` elements):

Locate where the `.ev-row` `div` is assembled and a reference to `row` is available.
After setting `row.className` / appending the timestamp, severity, and description spans,
add:

```javascript
if (ev.session_id) {
  const btn = document.createElement('button');
  btn.className = 'btn-block-session';
  btn.textContent = 'BLOCK';
  btn.title = `Block session ${ev.session_id}`;
  btn.onclick = (e) => {
    e.stopPropagation();
    void blockSession(ev.session_id, ev.instance_id || 'carina-local');
  };
  row.appendChild(btn);
}
```

### 6c. JavaScript - add the `blockSession` function near `killInstance()`:

```javascript
async function blockSession(sessionId, instanceId) {
  const short = String(sessionId).slice(0, 8);
  const reason = prompt(
    `Block session ${short}...?\n\nEnter reason (or Cancel to abort):`,
    'Suspicious activity'
  );
  if (reason === null || !reason.trim()) return;

  try {
    const r = await fetch(
      `/api/sessions/${encodeURIComponent(sessionId)}/block`,
      {
        method: 'POST',
        headers: H(),
        body: JSON.stringify({ reason: reason.trim(), instance_id: instanceId }),
      }
    );
    const d = await r.json();
    if (d.ok) {
      toast(`Session blocked: ${short}...`, 'warning');
    } else {
      toast('Block failed: ' + (d.error || 'unknown'), 'critical');
    }
  } catch {
    toast('Block request failed (network error)', 'critical');
  }
}
```

`H()` is the existing helper that returns `{ 'Content-Type': 'application/json', 'X-Scout-Key': window.__SCOUT_KEY }`.

---

## Test cases

Write tests in `src/api/__tests__/block-session.test.ts` using Vitest + supertest.

**Test 1 - valid block:**
`POST /api/sessions/test-session-001/block` with correct `X-Scout-Key` and body
`{ reason: 'Suspicious prompt injection', instance_id: 'carina-local' }`.
Expect 200, body `{ ok: true, session_id: 'test-session-001', status: 'blocked' }`.
Expect `blocked_sessions` row inserted in DB.
Expect `publishControlMessage` called once with `action:'block_session'`.

**Test 2 - wrong API key:**
Same request with wrong key. Expect 401 `{ error: 'Unauthorized' }`.
Expect no DB write, no Redis publish.

**Test 3 - idempotent re-block:**
Block the same session twice with different reasons.
Expect 200 both times. Expect one row in `blocked_sessions` with the second reason.

**Test 4 - Carina receives block_session message:**
Call `_processControlMessage(JSON.stringify({ action:'block_session', session_id:'s-001', instance_id:'carina-local', reason:'test' }))`.
Expect `isSessionBlocked('s-001')` to return `true`.
Expect `isSessionBlocked('s-002')` to return `false`.
Call `_clearBlockedSessions()`. Expect `isSessionBlocked('s-001')` to return `false`.

**Test 5 - other sessions unaffected:**
Block `session-A`. Confirm `isSessionBlocked('session-B')` is `false`.

---

## Coding standards

- All DB queries use parameterised placeholders (`$1`, `$2`). No string concatenation.
- All async Express handlers wrapped in try/catch; return 500 on unexpected errors.
- TypeScript strict mode. No `any`; use `unknown` and narrow with type guards.
- `publishControlMessage` already handles Redis unavailability with a `console.warn` and returns silently - no need to add extra guards.
- Functions under 20 lines; extract helpers when a handler grows beyond that.
- No magic strings: use `CONTROL_CHANNEL` from `src/lib/constants.ts` wherever the channel name is needed.
- Never log the full reason string at `info` level in production; use `console.warn` for operator actions.
