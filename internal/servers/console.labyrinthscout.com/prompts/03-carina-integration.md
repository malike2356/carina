# Labyrinth Scout - Prompt 03: Carina Agent Integration

## What you are building

Wire the running Carina AI agent (at `src/`) to report security events to Labyrinth Scout. When
`LABYRINTH_ENABLED=false` (the default), this integration must be completely invisible: zero HTTP
calls, zero performance impact, zero errors. When enabled, Carina reports tool calls and heartbeats
to Scout, and listens for kill-switch commands over Redis.

**Working directories:**
- New files: `/opt/lampp/htdocs/VERLOX/Carina-ai/src/security/`
- Modified files: `/opt/lampp/htdocs/VERLOX/Carina-ai/src/agents/tool-runner.ts`
- Modified files: `/opt/lampp/htdocs/VERLOX/Carina-ai/src/index.ts`
- Env vars: `/opt/lampp/htdocs/VERLOX/Carina-ai/.env` and `.env.example`

Do NOT touch anything in `labyrinthscout/` in this prompt.

---

## Context: Carina src/ structure (read before editing)

The files you must not break:
- `src/config/index.ts` - exports `config` object. You will add Labyrinth fields here.
- `src/memory/redis.ts` - exports `getRedis(): Redis | null`. Scout uses the same Redis instance.
- `src/agents/tool-runner.ts` - exports `executeToolCall(call, confirm?, alwaysConfirm?)`.
- `src/index.ts` - `main()` function; calls `initDb()`, `initRedis()`, `initRouter()`, gateways.

The tool registry (`src/tools/index.ts`) exports `registry.get(toolName)` which returns a `Tool`.
Tool names in production are: `web-search`, `file-read`, `http-request`, `shell-exec`,
`email-send`, `code-exec`. These are the six tools tracked in the Scout dashboard heatmap.

---

## Files to create

```
src/security/scout-client.ts         # HTTP client to post events to Scout
src/security/kill-switch-listener.ts # Redis subscriber for suspend commands
src/security/index.ts                # Re-exports public API of the security module
```

---

## Files to modify

```
src/config/index.ts    # Add labyrinth config block
src/agents/tool-runner.ts  # Instrument with reportToolCall + checkNotSuspended
src/index.ts               # Init kill switch listener + heartbeat interval
.env.example               # Document new env vars
```

---

## New environment variables

Add to `.env.example` (and to your local `.env`):

```
# Labyrinth Scout integration (security control plane)
# Set LABYRINTH_ENABLED=true to activate reporting. Safe to leave false in development.
LABYRINTH_ENABLED=false
LABYRINTH_URL=http://localhost:4444
LABYRINTH_API_KEY=your_scout_api_key_here
LABYRINTH_INSTANCE_ID=carina-local
LABYRINTH_INSTANCE_NAME=Carina Local
```

---

## 1. src/config/index.ts - add labyrinth block

After the existing config object, add a `labyrinth` key. Do not change any existing keys.

```typescript
// Add inside the config object:
labyrinth: {
  enabled: process.env.LABYRINTH_ENABLED === 'true',
  url: process.env.LABYRINTH_URL ?? 'http://localhost:4444',
  apiKey: process.env.LABYRINTH_API_KEY ?? '',
  instanceId: process.env.LABYRINTH_INSTANCE_ID ?? 'carina-local',
  instanceName: process.env.LABYRINTH_INSTANCE_NAME ?? 'Carina Local',
},
```

---

## 2. src/security/scout-client.ts

This is the most critical file in this prompt. Read the requirements carefully.

### Exports

```typescript
export async function reportEvent(event: ScoutEvent): Promise<void>
export async function reportToolCall(call: ToolCallReport): Promise<void>
export async function reportHeartbeat(): Promise<void>
```

### Types (define in this file or import from a local types file)

```typescript
interface ScoutEvent {
  severity: 'info' | 'warning' | 'critical' | 'breach';
  source: string;
  event_type: string;
  description: string;
  metadata?: Record<string, unknown>;
  session_id?: string;
  instance_id?: string;
}

interface ToolCallReport {
  toolName: string;
  params: Record<string, unknown>; // sanitised before sending
  resultSummary: string; // first 200 chars of result
  durationMs: number;
  sessionId?: string;
  success: boolean;
  errorMessage?: string;
}
```

### Guard: check enabled before doing anything

```typescript
function isEnabled(): boolean {
  return config.labyrinth.enabled && config.labyrinth.url !== '' && config.labyrinth.apiKey !== '';
}
```

Every exported function must call `if (!isEnabled()) return;` as its first line.
This means when `LABYRINTH_ENABLED=false`, there are absolutely zero network operations.

### HTTP transport

Use the built-in Node.js `fetch` (available in Node.js 22). Do not add an HTTP library dependency.

Base headers for every request:
```typescript
const HEADERS = {
  'Content-Type': 'application/json',
  'X-Scout-Key': config.labyrinth.apiKey,
};
```

Timeout: 2 seconds on all requests (use `AbortController`). If the request exceeds 2 seconds,
abort it. Log a single warning (not an error) the first time Scout is unreachable per process
lifetime. Subsequent failures are silent.

### Batching with debounce

Tool calls arrive in bursts. Batch them with a 100ms debounce:

```typescript
const eventQueue: ScoutEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushQueue();
  }, 100);
}

async function flushQueue(): Promise<void> {
  if (eventQueue.length === 0) return;
  const batch = eventQueue.splice(0, eventQueue.length);
  // Post each event individually (Scout /api/events takes one at a time)
  for (const event of batch) {
    await postToScout('/api/events', event);
  }
}

// reportEvent queues the event, then scheduleFlush()
// reportHeartbeat bypasses the queue and posts directly (low frequency, 60s interval)
```

### reportToolCall implementation

Tool call reports map to a `security_events` row with `event_type: 'tool_call'` and metadata
containing the structured data. The mapping:

```typescript
async function reportToolCall(call: ToolCallReport): Promise<void> {
  if (!isEnabled()) return;

  const sanitised = sanitiseParams(call.params);

  const event: ScoutEvent = {
    severity: call.success ? 'info' : 'warning',
    source: 'carina-agent',
    event_type: 'tool_call',
    description: call.success
      ? `Tool ${call.toolName} executed (${call.durationMs}ms)`
      : `Tool ${call.toolName} failed: ${call.errorMessage ?? 'unknown error'}`,
    metadata: {
      tool_name: call.toolName,
      params: sanitised,
      result_summary: call.resultSummary,
      duration_ms: call.durationMs,
      success: call.success,
    },
    session_id: call.sessionId,
    instance_id: config.labyrinth.instanceId,
  };

  eventQueue.push(event);
  scheduleFlush();
}
```

### sanitiseParams - remove API key values

Params may contain API keys or secrets passed by the LLM. Strip any value that matches a known
secret pattern before sending to Scout.

```typescript
const SECRET_PATTERNS = [
  /^sk-[a-zA-Z0-9]{20,}$/,      // OpenAI key
  /^[a-f0-9]{64}$/,              // 64-char hex (generic secret)
  /^Bearer\s+\S+/i,              // Bearer tokens
  /^Basic\s+[a-zA-Z0-9+/]+=*/i, // Basic auth
];

function isLikelySecret(value: string): boolean {
  return SECRET_PATTERNS.some((re) => re.test(value));
}

function sanitiseParams(params: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && isLikelySecret(value)) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = sanitiseParams(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}
```

### postToScout - internal helper, never throws

```typescript
let scoutUnreachableWarned = false;

async function postToScout(path: string, body: unknown): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    await fetch(`${config.labyrinth.url}${path}`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (!scoutUnreachableWarned) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[carina:scout] Scout unreachable: ${msg}. Subsequent failures silent.`);
      scoutUnreachableWarned = true;
    }
  } finally {
    clearTimeout(timeout);
  }
}
```

Note: `postToScout` does NOT check the HTTP status code. Scout returning 4xx means a bug in the
payload format. These should be logged during development but must never crash Carina in production.
Add an optional check: if response status >= 400 and `NODE_ENV !== 'production'`, log a warning
with the status and the body.

### reportHeartbeat

```typescript
async function reportHeartbeat(): Promise<void> {
  if (!isEnabled()) return;
  await postToScout('/api/heartbeat', {
    instance_id: config.labyrinth.instanceId,
    name: config.labyrinth.instanceName,
  });
}
```

---

## 3. src/security/kill-switch-listener.ts

### Overview

Subscribes to Redis channel `'labyrinth:control'`. On receiving a message with
`{ "action": "suspend", "instance_id": "<LABYRINTH_INSTANCE_ID>" }`, sets a module-level flag
`isSuspended = true`. The `checkNotSuspended()` function is called before every tool execution
and throws `AgentSuspendedError` if the flag is set.

### Full implementation

```typescript
import { getRedis } from '../memory/redis.js';
import { config } from '../config/index.js';
import { Redis } from 'ioredis';

export class AgentSuspendedError extends Error {
  constructor() {
    super(
      `Agent ${config.labyrinth.instanceId} has been suspended by Labyrinth Scout. ` +
      'All tool calls are blocked until reactivated.'
    );
    this.name = 'AgentSuspendedError';
  }
}

let isSuspended = false;
let subscriber: Redis | null = null;

export function checkNotSuspended(): void {
  if (isSuspended) throw new AgentSuspendedError();
}

export function initKillSwitchListener(): void {
  if (!config.labyrinth.enabled) return;

  // Use the existing Redis client to create a subscriber.
  // Cannot call getRedis() because subscriber clients cannot run commands.
  // Create a new connection from the same URL.
  try {
    subscriber = new Redis(config.redis.url, {
      maxRetriesPerRequest: 1,
      lazyConnect: false,
    });

    subscriber.on('error', (err) => {
      console.warn('[carina:kill-switch] Redis error:', err.message);
    });

    subscriber.subscribe('labyrinth:control', (err) => {
      if (err) {
        console.warn('[carina:kill-switch] Subscribe failed:', err.message);
        return;
      }
      console.log('[carina:kill-switch] Listening for suspend commands');
    });

    subscriber.on('message', (_channel, message) => {
      try {
        const cmd = JSON.parse(message) as {
          action: string;
          instance_id: string;
          reason?: string;
        };
        if (
          cmd.action === 'suspend' &&
          cmd.instance_id === config.labyrinth.instanceId
        ) {
          isSuspended = true;
          console.warn(
            `[carina:kill-switch] SUSPENDED. Reason: ${cmd.reason ?? 'none'}. ` +
            'All tool calls will now be blocked.'
          );
        }
      } catch {
        // malformed message, ignore
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[carina:kill-switch] Could not init listener: ${msg}. Kill switch inactive.`);
    // Do NOT rethrow - Carina must start even if Redis is unavailable.
  }
}

// For testing only - reset the suspended flag
export function _resetSuspendedFlag(): void {
  isSuspended = false;
}
```

Important: `initKillSwitchListener()` must never throw. Wrap the entire body in try/catch.
If Redis is unavailable, log a warning and return. Carina continues to function without the kill
switch - it just means the kill switch from the dashboard will not work until Redis recovers.

---

## 4. src/security/index.ts

Clean re-export so other modules import from one place:

```typescript
export { reportEvent, reportToolCall, reportHeartbeat } from './scout-client.js';
export { initKillSwitchListener, checkNotSuspended, AgentSuspendedError } from './kill-switch-listener.js';
```

---

## 5. Modify src/agents/tool-runner.ts

The current `executeToolCall` function:
1. Looks up the tool in the registry
2. Checks if confirmation is needed
3. Calls `tool.execute(call.params)`
4. Returns the result or an error object

You must add two things:

**Before the tool lookup**, add:
```typescript
import { checkNotSuspended, reportToolCall } from '../security/index.js';

// At the top of executeToolCall, before anything else:
checkNotSuspended(); // throws AgentSuspendedError if suspended
```

**After `tool.execute(call.params)`** (in both success and error paths), add:
```typescript
// Inside the try block, after result = await tool.execute(call.params):
const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
void reportToolCall({
  toolName: call.toolName,
  params: call.params,
  resultSummary: resultStr.slice(0, 200),
  durationMs: Date.now() - startTime,
  sessionId: call.sessionId,   // pass through if ToolCall has this field; otherwise omit
  success: true,
});

// In the catch block, after err is caught:
void reportToolCall({
  toolName: call.toolName,
  params: call.params,
  resultSummary: '',
  durationMs: Date.now() - startTime,
  sessionId: call.sessionId,
  success: false,
  errorMessage: err instanceof Error ? err.message : String(err),
});
```

Add `const startTime = Date.now();` at the top of `executeToolCall` (after `checkNotSuspended()`).

The `void` prefix on `reportToolCall` is intentional. Tool execution must not be delayed waiting
for Scout. Fire and forget.

If `ToolCall` type does not have a `sessionId` field, omit it from the calls above. Do not add
fields to existing types in this prompt.

Preserve the full existing logic of `executeToolCall`. Only add the three insertions above:
`checkNotSuspended()` at top, `startTime` capture, and two `reportToolCall` calls.

---

## 6. Modify src/index.ts

Two additions to the `main()` function, after `await initRedis()`:

```typescript
import { initKillSwitchListener, reportHeartbeat } from './security/index.js';

// In main(), after await initRedis():
if (config.labyrinth.enabled) {
  initKillSwitchListener();
  // Heartbeat: report immediately, then every 60 seconds
  void reportHeartbeat();
  setInterval(() => void reportHeartbeat(), 60_000);
}
```

Place this block before the gateway startup calls (before `initRouter`, before `startCLI`, etc.).

---

## Test cases

Write these tests to `src/security/scout-client.test.ts` using vitest (already configured at
repo root via `vitest.config.ts`).

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reportEvent, reportToolCall, reportHeartbeat } from './scout-client.js';

// Mock config to control LABYRINTH_ENABLED
vi.mock('../../config/index.js', () => ({
  config: {
    labyrinth: {
      enabled: false,
      url: 'http://localhost:4444',
      apiKey: 'test-key',
      instanceId: 'carina-test',
      instanceName: 'Carina Test',
    },
  },
}));

describe('scout-client - disabled', () => {
  it('reportEvent does not call fetch when disabled', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await reportEvent({
      severity: 'info',
      source: 'test',
      event_type: 'test',
      description: 'test',
    });
    // Wait for any potential debounce
    await new Promise((r) => setTimeout(r, 200));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('reportToolCall does not call fetch when disabled', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await reportToolCall({
      toolName: 'web-search',
      params: { query: 'test' },
      resultSummary: 'results',
      durationMs: 100,
      success: true,
    });
    await new Promise((r) => setTimeout(r, 200));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('reportHeartbeat does not call fetch when disabled', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await reportHeartbeat();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('scout-client - sanitiseParams', () => {
  // Export sanitiseParams for testing (or test via reportToolCall metadata)
  it('redacts OpenAI key pattern from params', async () => {
    // This test verifies that a param value matching /^sk-[a-zA-Z0-9]{20,}$/ is replaced
    // with '[REDACTED]' in the metadata sent to Scout.
    // Implementation: inspect the fetch call body after enabling the client in test mode.
    // (Test structure left for implementer - mock config.labyrinth.enabled = true, spy on fetch)
    expect(true).toBe(true); // placeholder - replace with real assertion
  });
});

describe('kill-switch-listener', () => {
  it('checkNotSuspended does not throw before suspend command', () => {
    const { checkNotSuspended, _resetSuspendedFlag } = await import('./kill-switch-listener.js');
    _resetSuspendedFlag();
    expect(() => checkNotSuspended()).not.toThrow();
  });

  it('checkNotSuspended throws AgentSuspendedError after manual flag set', async () => {
    const { checkNotSuspended, AgentSuspendedError, _resetSuspendedFlag } =
      await import('./kill-switch-listener.js');
    _resetSuspendedFlag();
    // Simulate the flag being set (in production this comes via Redis message)
    // The flag is module-level; we use _resetSuspendedFlag to reset between tests.
    // To set it, we would need to emit a Redis message. For unit testing, expose a _setSuspended
    // function similar to _resetSuspendedFlag.
    expect(AgentSuspendedError).toBeDefined();
  });
});
```

Also add `_setSuspendedFlag()` to `kill-switch-listener.ts` for testing purposes:
```typescript
export function _setSuspendedFlag(): void {
  isSuspended = true;
}
```

---

## Integration verification (manual, with Scout running)

1. Set `LABYRINTH_ENABLED=false` in `.env`. Start Carina. Run a tool call via CLI. Check Scout
   DB: `SELECT count(*) FROM security_events WHERE event_type='tool_call';` should be 0.

2. Set `LABYRINTH_ENABLED=true`. Restart Carina. Scout must receive a heartbeat within 5 seconds.
   Check: `SELECT id, name, last_heartbeat FROM carina_instances;` should show one row.

3. Ask Carina to perform a web search. Within 200ms of the tool completing, a `tool_call` event
   should appear in Scout's `security_events` table and flash in the dashboard.

4. From the Scout dashboard, click the kill switch for the local instance and confirm. The Redis
   channel `labyrinth:control` receives the message. Within one tool call attempt, Carina returns
   an error to the user ("Agent has been suspended...") and logs `[carina:kill-switch] SUSPENDED`.

5. Stop Scout process. Run several tool calls in Carina. All succeed normally (no errors related
   to Scout). The Scout warnings appear at most once in the Carina log.

6. With `LABYRINTH_ENABLED=true` and Scout running, a tool call to `shell-exec` with params
   containing a value matching `sk-abc123...` (OpenAI key pattern) stores `[REDACTED]` in the
   Scout event metadata, not the real key. Verify with:
   ```sql
   SELECT metadata FROM security_events WHERE event_type='tool_call' ORDER BY created_at DESC LIMIT 1;
   ```

---

## Constraints

- The `scout-client.ts` file must never import from `../memory/redis.ts`. It uses only `fetch`.
  Redis is used only in `kill-switch-listener.ts` for the subscriber.
- Adding `import` statements to `tool-runner.ts` is the only addition allowed at the top of that
  file. All new logic goes inside the existing `executeToolCall` function body.
- `initKillSwitchListener()` is synchronous (returns `void`, not `Promise<void>`). It fires and
  forgets the subscriber setup internally.
- All new files must pass `tsc --noEmit` from the repo root (the root `tsconfig.json` covers
  the `src/` directory).
- The heartbeat `setInterval` must not prevent the process from exiting cleanly. Wrap the interval
  reference: `const heartbeatInterval = setInterval(...); process.on('SIGTERM', () => clearInterval(heartbeatInterval));`
  Add this cleanup alongside the existing SIGTERM handler in `index.ts`.
- `reportToolCall` uses `void` (fire-and-forget). Tool execution latency must not increase.
  The 100ms debounce means Scout receives batched events shortly after the burst, not during it.
