# Labyrinth Scout - Prompt 25: Adjust Rate Limit (Dashboard Action)

## Context

Labyrinth Scout is a Node.js/TypeScript security control plane monitoring Carina AI agent
instances. Scout runs at port 4444. This prompt adds per-session rate limit override: an
operator can throttle or relax the tool-call rate for a specific session without restarting
anything.

**Project root:** `/opt/lampp/htdocs/VERLOX/Carina-ai/`
**Scout source:** `console.labyrinthscout.com/src/`
**Carina source:** `core.carinaai.uk/src/`
**Dashboard:** `console.labyrinthscout.com/public/dashboard.html`
**Stack:** Node.js 22, TypeScript 5, Express 5, PostgreSQL 16, Redis 7 (ioredis). No PHP.

**Files that already exist and must not be recreated:**
- `src/security/tool-policy.ts` - `ToolPolicyEnforcer`, `RateLimitError`, default policy
- `src/server.ts` - Express app; mount new router here
- `src/db.ts` - exports `pool` (pg.Pool)
- `src/redis.ts` - exports `getRedis()`, `createSubscriber()`
- `src/middleware/auth.ts` - exports `requireApiKey`
- `core.carinaai.uk/src/security/kill-switch-listener.ts` - listens on `labyrinth:control`
- `core.carinaai.uk/src/security/tool-policy.ts` - Carina-side `ToolPolicyEnforcer`

The Redis channel for control messages is `labyrinth:control`. Scout publishes; Carina subscribes.

---

## What to Build

### 1. New file: `src/api/rate-control.ts`

Create a new Express router. Full implementation, no stubs.

```typescript
import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';
import { getRedis } from '../redis.js';

export const rateControlRouter: IRouter = Router();

const REDIS_KEY = (instanceId: string, sessionId: string) =>
  `scout:ratelimit:${instanceId}:${sessionId}`;

const MIN_CPM = 1;
const MAX_CPM = 200;
const TTL_SECONDS = 3600; // 1 hour

// POST /api/rate-limit
// Body: { session_id, instance_id, calls_per_minute, reason }
// Returns: { ok: true, session_id, calls_per_minute, expires_in_minutes: 60 }
rateControlRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  const sessionId  = typeof body.session_id  === 'string' ? body.session_id.trim()  : '';
  const instanceId = typeof body.instance_id === 'string' ? body.instance_id.trim() : '';
  const cpm        = typeof body.calls_per_minute === 'number' ? body.calls_per_minute : NaN;
  const reason     = typeof body.reason === 'string' ? body.reason.trim() : '';

  if (!sessionId)  { res.status(400).json({ error: 'session_id is required' }); return; }
  if (!instanceId) { res.status(400).json({ error: 'instance_id is required' }); return; }
  if (!Number.isInteger(cpm) || cpm < MIN_CPM || cpm > MAX_CPM) {
    res.status(400).json({ error: `calls_per_minute must be an integer between ${MIN_CPM} and ${MAX_CPM}` });
    return;
  }
  if (!reason) { res.status(400).json({ error: 'reason is required' }); return; }

  const redis = getRedis();

  try {
    // 1. Store in Redis with 1-hour TTL
    if (redis) {
      await redis.set(REDIS_KEY(instanceId, sessionId), String(cpm), 'EX', TTL_SECONDS);
    }

    // 2. Publish control message so Carina picks it up immediately
    if (redis) {
      await redis.publish(
        'labyrinth:control',
        JSON.stringify({ action: 'set_rate_limit', session_id: sessionId, instance_id: instanceId, calls_per_minute: cpm, reason }),
      );
    }

    // 3. Log security event
    await pool.query(
      `INSERT INTO security_events
         (instance_id, event_type, severity, source, description, metadata, session_id)
       VALUES ($1, 'rate_limit_adjusted', 'warning', 'rate-control-api', $2, $3, $4)`,
      [
        instanceId,
        `Rate limit set to ${cpm}/min for session ${sessionId.slice(0, 8)}...: ${reason}`,
        JSON.stringify({ calls_per_minute: cpm, reason, session_id: sessionId }),
        sessionId,
      ],
    );

    res.json({ ok: true, session_id: sessionId, calls_per_minute: cpm, expires_in_minutes: 60 });
  } catch (err) {
    console.error('[rate-control] POST error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/rate-limit?instance_id=xxx&session_id=yyy
// Returns: { session_id, instance_id, calls_per_minute, source: 'override'|'default' }
rateControlRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const instanceId = typeof req.query.instance_id === 'string' ? req.query.instance_id.trim() : '';
  const sessionId  = typeof req.query.session_id  === 'string' ? req.query.session_id.trim()  : '';

  if (!instanceId || !sessionId) {
    res.status(400).json({ error: 'instance_id and session_id query parameters are required' });
    return;
  }

  try {
    const redis = getRedis();
    const stored = redis ? await redis.get(REDIS_KEY(instanceId, sessionId)) : null;

    if (stored !== null) {
      res.json({ session_id: sessionId, instance_id: instanceId, calls_per_minute: parseInt(stored, 10), source: 'override' });
    } else {
      // Return the Scout-side default (Carina uses SCOUT_RATE_LIMIT_MINUTE or 15)
      const defaultCpm = process.env.SCOUT_RATE_LIMIT_MINUTE
        ? parseInt(process.env.SCOUT_RATE_LIMIT_MINUTE, 10)
        : 15;
      res.json({ session_id: sessionId, instance_id: instanceId, calls_per_minute: defaultCpm, source: 'default' });
    }
  } catch (err) {
    console.error('[rate-control] GET error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/rate-limit?instance_id=xxx&session_id=yyy
// Removes the override; Carina reverts to default on next call
rateControlRouter.delete('/', async (req: Request, res: Response): Promise<void> => {
  const instanceId = typeof req.query.instance_id === 'string' ? req.query.instance_id.trim() : '';
  const sessionId  = typeof req.query.session_id  === 'string' ? req.query.session_id.trim()  : '';

  if (!instanceId || !sessionId) {
    res.status(400).json({ error: 'instance_id and session_id query parameters are required' });
    return;
  }

  try {
    const redis = getRedis();
    if (redis) {
      await redis.del(REDIS_KEY(instanceId, sessionId));
      await redis.publish(
        'labyrinth:control',
        JSON.stringify({ action: 'clear_rate_limit', session_id: sessionId, instance_id: instanceId }),
      );
    }

    res.json({ ok: true, session_id: sessionId, instance_id: instanceId });
  } catch (err) {
    console.error('[rate-control] DELETE error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### 2. Mount the router in `src/server.ts`

Add import and mount. Insert these two lines alongside the existing router imports and mounts:

```typescript
// import (at top with other imports)
import { rateControlRouter } from './api/rate-control.js';

// mount (alongside other app.use calls)
app.use('/api/rate-limit', requireApiKey, rateControlRouter);
```

### 3. Modify `core.carinaai.uk/src/security/kill-switch-listener.ts`

Add per-session rate limit state and handler. The existing `applyControlPayload` function
handles `suspend` and `resume` actions. Add handling for `set_rate_limit` and `clear_rate_limit`
without touching any of the existing logic.

Add after the module-level state variables (`let suspended`, `let suspensionReason`, etc.):

```typescript
// Per-session rate limit overrides. Populated via Scout control messages.
const sessionRateLimits = new Map<string, number>();

export function getSessionRateLimit(sessionId: string): number | null {
  return sessionRateLimits.get(sessionId) ?? null;
}
```

In the existing `applyControlPayload` function, add two new action branches inside the
`if (payload.action === 'suspend') { ... } else if (payload.action === 'resume') { ... }`
chain:

```typescript
  } else if (payload.action === 'set_rate_limit') {
    const sid = payload.session_id;
    const cpm = payload.calls_per_minute;
    if (typeof sid === 'string' && typeof cpm === 'number' && cpm >= 1) {
      sessionRateLimits.set(sid, cpm);
      console.log(`[KillSwitch] Rate limit set: ${cpm}/min for session ${sid.slice(0, 8)}...`);
    }
  } else if (payload.action === 'clear_rate_limit') {
    const sid = payload.session_id;
    if (typeof sid === 'string') {
      sessionRateLimits.delete(sid);
      console.log(`[KillSwitch] Rate limit cleared for session ${sid.slice(0, 8)}...`);
    }
  }
```

Also export a test helper for unit tests:

```typescript
export function _resetRateLimits(): void {
  sessionRateLimits.clear();
}
```

### 4. Modify `core.carinaai.uk/src/security/tool-policy.ts` (Carina side)

The existing `enforceRateLimit` private method in `ToolPolicyEnforcer` uses
`this.policy.rateLimit.callsPerMinute` for the minute limit. Make it check for a session
override first.

Import the new function at the top of the file:

```typescript
import { getSessionRateLimit } from './kill-switch-listener.js';
```

In `enforceRateLimit(sessionId: string)`, replace the line that reads the minute limit:

```typescript
// Before:
if (minuteCount > this.policy.rateLimit.callsPerMinute) {

// After:
const effectiveCpm = getSessionRateLimit(sessionId) ?? this.policy.rateLimit.callsPerMinute;
if (minuteCount > effectiveCpm) {
```

Also update the error throw and the report call to use `effectiveCpm`:

```typescript
  await this.report('rate-limit', 'rate_limit_exceeded', 'warning', {
    window: 'minute',
    count: minuteCount,
    limit: effectiveCpm,
    session: sessionId,
    source: getSessionRateLimit(sessionId) !== null ? 'operator_override' : 'default',
  });
  throw new RateLimitError('minute', effectiveCpm);
```

The hour limit is unchanged (overrides only apply to per-minute limits).

### 5. Update `public/dashboard.html`

#### 5a. Add THROTTLE button to the event stream row renderer

Find the existing event-row rendering section (the `appendEvent` or `addEventRow` function
that builds a `div.event-row` for each incoming SSE event). After the existing BLOCK SESSION
button (if present) or at the end of the action buttons for events that have a `session_id`,
add a THROTTLE button:

```javascript
// In the event row builder, inside the block that checks ev.session_id:
if (ev.session_id) {
  const rlBtn = document.createElement('button');
  rlBtn.className = 'btn-action';
  rlBtn.style.cssText = 'border-color:rgba(230,192,123,.5);color:#e6c07b';
  rlBtn.textContent = 'THROTTLE';
  rlBtn.title = 'Adjust rate limit for this session';
  rlBtn.onclick = () => promptRateLimit(ev.session_id, ev.instance_id || 'carina-local');
  actions.appendChild(rlBtn);
}
```

#### 5b. Add rate limit functions to the `<script>` block

Add alongside the existing kill/resume functions:

```javascript
function promptRateLimit(sessionId, instanceId) {
  const raw = prompt(`Max tool calls per minute for session ${sessionId.slice(0,8)}... (1-200):`, '5');
  if (raw === null) return;
  const cpm = parseInt(raw, 10);
  if (!Number.isInteger(cpm) || cpm < 1 || cpm > 200) {
    toast('Invalid rate limit. Enter a number 1-200.', 'warning');
    return;
  }
  const reason = prompt('Reason for throttle:', 'Suspicious activity') || 'Operator throttle';
  void setSessionRateLimit(sessionId, instanceId, cpm, reason);
}

async function setSessionRateLimit(sessionId, instanceId, cpm, reason) {
  try {
    const r = await fetch('/api/rate-limit', {
      method: 'POST',
      headers: H(),
      body: JSON.stringify({ session_id: sessionId, instance_id: instanceId, calls_per_minute: cpm, reason }),
    });
    const d = await r.json();
    if (d.ok) {
      toast(`Rate limit: ${cpm}/min for session ${sessionId.slice(0,8)}... (1 hr)`, 'warning');
    } else {
      toast('Rate limit failed: ' + (d.error || 'unknown'), 'critical');
    }
  } catch {
    toast('Rate limit request failed', 'critical');
  }
}

async function clearSessionRateLimit(sessionId, instanceId) {
  try {
    const r = await fetch(
      `/api/rate-limit?session_id=${encodeURIComponent(sessionId)}&instance_id=${encodeURIComponent(instanceId)}`,
      { method: 'DELETE', headers: H() },
    );
    const d = await r.json();
    if (d.ok) toast(`Rate limit cleared for session ${sessionId.slice(0,8)}...`, 'ok');
    else toast('Clear failed: ' + (d.error || ''), 'warning');
  } catch {
    toast('Clear request failed', 'warning');
  }
}
```

---

## Test Cases

1. `POST /api/rate-limit` with `{ session_id:'abc123', instance_id:'carina-local', calls_per_minute:3, reason:'test' }`
   - Response: `{ ok: true, session_id:'abc123', calls_per_minute:3, expires_in_minutes:60 }`
   - `GET redis scout:ratelimit:carina-local:abc123` returns `'3'` with TTL ~3600

2. Carina's `ToolPolicyEnforcer.enforceRateLimit('abc123')` uses limit of 3, not the default 15
   - 4th tool call in a minute throws `RateLimitError('minute', 3)`
   - Other sessions with no override use the default 15

3. `GET /api/rate-limit?instance_id=carina-local&session_id=abc123`
   - Returns `{ calls_per_minute:3, source:'override' }`

4. `GET /api/rate-limit?instance_id=carina-local&session_id=unknown-session`
   - Returns `{ calls_per_minute:15, source:'default' }`

5. `DELETE /api/rate-limit?instance_id=carina-local&session_id=abc123`
   - Redis key deleted, `clear_rate_limit` message published
   - Subsequent `enforceRateLimit('abc123')` uses default 15

6. After 1 hour, Redis key expires automatically
   - `getSessionRateLimit` does not get refreshed by Redis expiry (in-memory Map retains it)
   - Mitigation: Carina listener receives `clear_rate_limit` message OR operator issues DELETE

7. Dashboard event row with `session_id` shows THROTTLE button in amber
   - Clicking prompts for CPM and reason, then POSTs to `/api/rate-limit`
   - Toast appears with the new limit
