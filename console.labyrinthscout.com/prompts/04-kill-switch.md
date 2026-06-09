# Labyrinth Scout - Prompt 04: Kill Switch

## Context

Labyrinth Scout is a Node.js/TypeScript security control plane that monitors Carina AI agent
instances. Scout runs at port 4444. This prompt implements the kill switch system end-to-end:
Scout can suspend and resume any Carina instance instantly via Redis pub/sub.

**Project root:** `/opt/lampp/htdocs/VERLOX/Carina-ai/`
**Scout source:** `labyrinthscout/src/`
**Carina source:** `src/`
**Stack:** Node.js 22, TypeScript 5, Express 5, PostgreSQL 16, Redis 7 (ioredis), no PHP.

Shared infrastructure: Scout and Carina use the same PostgreSQL database and Redis instance.
The Scout HTTP server is already established from prompt 02. The event-reporting hook in Carina
is already established from prompt 03. This prompt adds the kill switch on top of both.

---

## What to Build

### 1. Scout: `labyrinthscout/src/api/kill.ts`

Express router. Mount at the Scout app root as `router.use('/api', killRouter)`.

```typescript
// POST /api/kill/:instanceId
// Header: X-Scout-Key: <string>
// Body: { reason: string }
// Returns: { ok: true, instance_id: string, status: 'suspended' }
```

Implementation steps in order:

1. Validate `X-Scout-Key` header against `process.env.SCOUT_API_KEY`. Return 401 with
   `{ error: 'Unauthorized' }` if missing or wrong.
2. Validate body: `reason` must be a non-empty string, max 500 chars. Return 400 with
   `{ error: 'reason is required and must be a non-empty string' }` if invalid.
3. Update the `carina_instances` table:
   ```sql
   UPDATE carina_instances
   SET status = 'suspended', suspension_reason = $1, updated_at = NOW()
   WHERE instance_id = $2
   RETURNING instance_id, status
   ```
   If no row returned, respond 404 with `{ error: 'Instance not found' }`.
4. Publish to Redis channel `labyrinth:control`:
   ```json
   {
     "action": "suspend",
     "instance_id": "<instanceId>",
     "reason": "<reason>",
     "timestamp": "<ISO 8601>"
   }
   ```
   Use `JSON.stringify()`. Use the shared Redis client (not a subscriber connection).
5. Insert a security event row:
   ```sql
   INSERT INTO security_events
     (instance_id, event_type, severity, metadata, created_at)
   VALUES
     ($1, 'kill_switch_activated', 'critical', $2, NOW())
   ```
   Where metadata is `JSON.stringify({ reason, triggered_by: 'api' })`.
6. Return 200 `{ ok: true, instance_id, status: 'suspended' }`.

Wrap the entire handler body in try/catch. On error: log with `console.error`, return 500
`{ error: 'Internal server error' }`. Never leak stack traces to the response.

---

### 2. Scout: `labyrinthscout/src/api/resume.ts`

```typescript
// POST /api/resume/:instanceId
// Header: X-Scout-Key: <string>
// Body: (empty or ignored)
// Returns: { ok: true, instance_id: string, status: 'active' }
```

Implementation steps in order:

1. Validate `X-Scout-Key` as above. Return 401 if wrong.
2. Update `carina_instances`:
   ```sql
   UPDATE carina_instances
   SET status = 'active', suspension_reason = NULL, updated_at = NOW()
   WHERE instance_id = $1 AND status = 'suspended'
   RETURNING instance_id, status
   ```
   If no row returned, return 404 `{ error: 'Instance not found or not suspended' }`.
3. Publish to Redis channel `labyrinth:control`:
   ```json
   {
     "action": "resume",
     "instance_id": "<instanceId>",
     "timestamp": "<ISO 8601>"
   }
   ```
4. Insert security event: event_type `'kill_switch_resumed'`, severity `'info'`.
5. Return 200 `{ ok: true, instance_id, status: 'active' }`.

---

### 3. Scout: Update the dashboard HTML

The dashboard HTML lives in `labyrinthscout/src/dashboard/index.html` (or equivalent template).
Update the instance card to show:

- A red "Suspend" button for active instances. On click: `POST /api/kill/:instanceId` with
  `{ reason: prompt('Reason for suspension:') }` and `X-Scout-Key` from a local JS variable
  populated from a `<meta name="scout-key">` tag (value injected server-side via template).
- A green "Resume" button for suspended instances (replace the Suspend button entirely).
- Display the `suspension_reason` text in an orange badge when status is `'suspended'`.
- After a successful kill/resume API call, reload the instance list without a full page refresh
  (re-fetch `/api/instances` and re-render the cards).

Do not store the Scout API key in localStorage. Pass it server-side into the HTML template
as a `data-` attribute on the body element or a `<meta>` tag. Avoid inline event handlers;
use `addEventListener`.

---

### 4. Carina: `src/security/kill-switch-listener.ts`

Full module. Replace any stub from prompt 03 with this complete implementation.

```typescript
import Redis from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';

// Module-level state. Private. Not exported.
let suspended = false;
let suspensionReason = '';
let subscriber: Redis | null = null;

const LOG_PATH = path.join(process.cwd(), 'data', 'logs', 'labyrinth-suspend.log');
const CHANNEL = 'labyrinth:control';

function appendLog(line: string): void {
  const entry = `[${new Date().toISOString()}] ${line}\n`;
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.appendFileSync(LOG_PATH, entry, 'utf8');
}

export function checkNotSuspended(): void {
  if (suspended) {
    throw new Error(
      `Carina is suspended by Labyrinth Scout. Reason: ${suspensionReason}. Contact administrator.`
    );
  }
}

export function isSuspended(): boolean {
  return suspended;
}

export function initKillSwitchListener(): () => void {
  if (!process.env.LABYRINTH_ENABLED || process.env.LABYRINTH_ENABLED !== 'true') {
    return () => {}; // no-op cleanup
  }

  const instanceId = process.env.LABYRINTH_INSTANCE_ID;
  if (!instanceId) {
    console.warn('[KillSwitch] LABYRINTH_INSTANCE_ID not set. Kill switch disabled.');
    return () => {};
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  // IMPORTANT: ioredis requires a DEDICATED connection for subscribe mode.
  // Never reuse the shared Redis client for subscriptions.
  try {
    subscriber = new Redis(redisUrl, {
      lazyConnect: false,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  } catch (err) {
    console.warn('[KillSwitch] Failed to create Redis subscriber. Kill switch disabled.', err);
    return () => {};
  }

  subscriber.on('error', (err) => {
    console.warn('[KillSwitch] Redis subscriber error. Kill switch may not function:', err.message);
    // Never throw - Carina must keep running even if Redis is down.
  });

  subscriber.subscribe(CHANNEL, (err) => {
    if (err) {
      console.warn('[KillSwitch] Failed to subscribe to channel:', err.message);
    } else {
      console.log(`[KillSwitch] Subscribed to ${CHANNEL} for instance ${instanceId}`);
    }
  });

  subscriber.on('message', (channel, message) => {
    if (channel !== CHANNEL) return;

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(message);
    } catch {
      return; // malformed message, ignore
    }

    if (payload.instance_id !== instanceId) return; // not for this instance

    if (payload.action === 'suspend') {
      suspended = true;
      suspensionReason = (payload.reason as string) || 'No reason provided';
      const logLine = `SUSPENDED by Scout. Reason: ${suspensionReason}`;
      console.error(`[KillSwitch] ${logLine}`);
      appendLog(logLine);
    } else if (payload.action === 'resume') {
      suspended = false;
      suspensionReason = '';
      const logLine = 'RESUMED by Scout.';
      console.log(`[KillSwitch] ${logLine}`);
      appendLog(logLine);
    }
  });

  // Return cleanup function for graceful shutdown.
  return () => {
    subscriber?.unsubscribe();
    subscriber?.disconnect();
    subscriber = null;
  };
}
```

Rules:
- The subscriber connection is separate from the shared `ioredis` client used elsewhere in
  Carina. Never pass the shared client to `.subscribe()`.
- If `new Redis(...)` throws, catch it, log a warning, and return a no-op cleanup. Never
  crash Carina at startup due to a missing Redis.
- If `LABYRINTH_ENABLED !== 'true'`, return a no-op immediately. Zero overhead when Scout
  is not in use.

---

### 5. Carina: Integrate into `src/agents/tool-runner.ts`

At the top of the file, add:

```typescript
import { checkNotSuspended } from '../security/kill-switch-listener.js';
```

At the very start of the tool execution function (before any tool lookup or param validation),
add:

```typescript
if (process.env.LABYRINTH_ENABLED === 'true') {
  checkNotSuspended(); // throws Error if suspended
}
```

The thrown error propagates up the call stack. The agent turn handler already catches tool
errors and returns them as a tool result message. No additional try/catch is needed here.
The user sees a clean message: "Carina is suspended by Labyrinth Scout. Reason: ... Contact
administrator."

---

### 6. Carina: Register listener at startup

In `src/index.ts` (or wherever the process bootstraps), call `initKillSwitchListener()` once
and store the cleanup:

```typescript
import { initKillSwitchListener } from './security/kill-switch-listener.js';

const cleanupKillSwitch = initKillSwitchListener();

process.on('SIGTERM', () => { cleanupKillSwitch(); process.exit(0); });
process.on('SIGINT',  () => { cleanupKillSwitch(); process.exit(0); });
```

---

## Database Schema (apply if not already present)

```sql
-- carina_instances must have these columns:
ALTER TABLE carina_instances
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- security_events table:
CREATE TABLE IF NOT EXISTS security_events (
  id            BIGSERIAL PRIMARY KEY,
  instance_id   TEXT        NOT NULL,
  event_type    TEXT        NOT NULL,
  severity      TEXT        NOT NULL CHECK (severity IN ('info','warning','error','critical')),
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_instance
  ON security_events (instance_id, created_at DESC);
```

---

## Environment Variables (add to `.env.example`)

```
# Labyrinth Scout (Carina side)
LABYRINTH_ENABLED=true
LABYRINTH_INSTANCE_ID=carina-local-001
LABYRINTH_SCOUT_URL=http://localhost:4444

# Labyrinth Scout (Scout side)
SCOUT_API_KEY=change-me-in-production
```

---

## Test Cases

Write these as Vitest unit/integration tests in `labyrinthscout/src/api/__tests__/kill.test.ts`
and `src/security/__tests__/kill-switch-listener.test.ts`.

**Test 1 - Valid kill request:**
POST /api/kill/:instanceId with correct X-Scout-Key and `{ reason: 'policy violation' }`.
Expect 200, body `{ ok: true, instance_id, status: 'suspended' }`.
Expect Redis `publish` called once on channel `labyrinth:control` with action `'suspend'`.
Expect `carina_instances.status` set to `'suspended'` in the database.

**Test 2 - Wrong API key:**
POST /api/kill/:instanceId with wrong X-Scout-Key.
Expect 401 `{ error: 'Unauthorized' }`. Expect no Redis publish, no DB write.

**Test 3 - Carina receives suspend message:**
Call `initKillSwitchListener()` in test with mocked subscriber.
Emit a message on `labyrinth:control` with `{ action: 'suspend', instance_id: 'test-001', reason: 'test' }`.
Expect `checkNotSuspended()` to throw with message containing 'suspended by Labyrinth Scout'.

**Test 4 - Carina receives resume message after suspension:**
Follow from Test 3. Emit `{ action: 'resume', instance_id: 'test-001' }`.
Expect `checkNotSuspended()` to return without throwing.

**Test 5 - Redis unavailable at startup:**
Mock `new Redis(...)` to throw `new Error('ECONNREFUSED')`.
Call `initKillSwitchListener()`. Expect no unhandled exception. Expect `checkNotSuspended()`
to return normally (suspended remains false). Expect a warning logged to console.

---

## Coding Standards

- No magic strings: define `CHANNEL`, `STATUS_SUSPENDED`, `STATUS_ACTIVE` as constants.
- All DB queries use parameterised values (`$1`, `$2` pattern with pg pool). Never string
  concatenation.
- All async Express handlers wrapped in try/catch; never let unhandled rejections crash Scout.
- TypeScript strict mode. No `any` except where ioredis types force it; use `unknown` and
  narrow with type guards.
- Functions under 30 lines. If the handler is longer, extract helpers.
- No console.log in production paths; use a logger (console.error for errors, console.warn
  for warnings, console.log for info - replace with pino/winston if the project already uses one).
