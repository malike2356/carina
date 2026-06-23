# Labyrinth Scout - Prompt 06: Tool Policy Executor

## Context

Labyrinth Scout is a Node.js/TypeScript security control plane monitoring Carina AI agent
instances. Scout runs at port 4444. This prompt implements the tool policy executor: a module
that intercepts every tool call Carina attempts and enforces a configurable policy (allowlist,
blocklist, confirmation gates, shell safety, rate limits).

**Project root:** `/opt/lampp/htdocs/VERLOX/Carina-ai/`
**Scout source:** `labyrinthscout/src/`
**Carina source:** `src/`
**Stack:** Node.js 22, TypeScript 5, Express 5, PostgreSQL 16, Redis 7 (ioredis), no PHP.

Policy enforcement lives in `labyrinthscout/src/security/tool-policy.ts`. Carina's tool
runner imports and calls it. When `LABYRINTH_ENABLED=false`, the enforcer must be a
complete no-op with zero overhead.

---

## What to Build

### 1. `labyrinthscout/src/security/tool-policy.ts`

Full implementation. No stubs.

#### Types

```typescript
export interface ToolPolicy {
  allowlist: string[]; // tools that run without any gate
  requireConfirmList: string[]; // tools needing user confirmation before first run
  blocklist: string[]; // tools never allowed under any circumstance
  dangerousCommands: RegExp[]; // patterns matched against shell command strings
  rateLimit: {
    callsPerMinute: number;
    callsPerHour: number;
  };
}

export interface EnforceParams {
  command?: string; // for shell-exec tool
  _confirmed?: boolean; // true if user has already confirmed this call
  [key: string]: unknown;
}
```

#### Custom error classes

Define all four in this file. Each extends `Error`.

```typescript
export class ToolBlockedError extends Error {
  readonly code = 'TOOL_BLOCKED';
  constructor(toolName: string) {
    super(`Tool '${toolName}' is blocked by Labyrinth Scout policy.`);
    this.name = 'ToolBlockedError';
  }
}

export class DangerousCommandError extends Error {
  readonly code = 'DANGEROUS_COMMAND';
  constructor(command: string, pattern: string) {
    super(`Command refused by Labyrinth Scout: matched dangerous pattern '${pattern}'. Command: ${command.slice(0, 100)}`);
    this.name = 'DangerousCommandError';
  }
}

export class RateLimitError extends Error {
  readonly code = 'RATE_LIMIT';
  constructor(window: 'minute' | 'hour', limit: number) {
    super(`Tool call rate limit exceeded: ${limit} calls per ${window} (Labyrinth Scout).`);
    this.name = 'RateLimitError';
  }
}

export class ConfirmationRequiredError extends Error {
  readonly code = 'CONFIRMATION_REQUIRED';
  constructor(toolName: string) {
    super(
      `Tool '${toolName}' requires user confirmation before executing. ` +
      `Re-submit the tool call with params._confirmed = true to proceed.`
    );
    this.name = 'ConfirmationRequiredError';
  }
}
```

`ConfirmationRequiredError` is a UX gate, not a security event. Do NOT report it to Scout.
The other three all report to Scout before throwing.

#### Default policy

```typescript
export const DEFAULT_POLICY: ToolPolicy = {
  allowlist: ['web-search', 'file-read', 'http-request', 'email-list'],
  requireConfirmList: ['file-write', 'email-send'],
  blocklist: [],   // populated at runtime from SCOUT_BLOCKLIST env var
  dangerousCommands: [
    /rm\s+(-rf?|--recursive)?\s*\//i,
    /dd\s+if=/,
    /:\(\)\s*\{\s*:|:&\s*\};:/,       // fork bomb
    /chmod\s+777\s+\//,
    /curl.*\|\s*(bash|sh)/i,
    /wget.*\|\s*(bash|sh)/i,
    /base64\s+-d.*\|\s*(bash|sh)/i,
    /mkfs/i,
    />\s*\/dev\/(sda|hda|nvme)/i,
  ],
  rateLimit: {
    callsPerMinute: 15,
    callsPerHour: 200,
  },
};
```

#### Loading policy from environment

```typescript
export function loadPolicyFromEnv(base: ToolPolicy = DEFAULT_POLICY): ToolPolicy {
  const blocklist = process.env.SCOUT_BLOCKLIST
    ? process.env.SCOUT_BLOCKLIST.split(',').map(s => s.trim()).filter(Boolean)
    : base.blocklist;

  const callsPerMinute = process.env.SCOUT_RATE_LIMIT_MINUTE
    ? parseInt(process.env.SCOUT_RATE_LIMIT_MINUTE, 10)
    : base.rateLimit.callsPerMinute;

  const callsPerHour = process.env.SCOUT_RATE_LIMIT_HOUR
    ? parseInt(process.env.SCOUT_RATE_LIMIT_HOUR, 10)
    : base.rateLimit.callsPerHour;

  return {
    ...base,
    blocklist,
    rateLimit: { callsPerMinute, callsPerHour },
  };
}
```

Call `loadPolicyFromEnv()` once when the module initialises (module-level constant), not on
every `enforce()` call. This avoids re-reading env vars on every tool call.

#### `ToolPolicyEnforcer` class

```typescript
export class ToolPolicyEnforcer {
  private readonly policy: ToolPolicy;

  constructor(
    private readonly redis: Redis,
    private readonly reportFn: (event: SecurityEvent) => Promise<void>,
    policy?: ToolPolicy
  ) {
    this.policy = policy ?? loadPolicyFromEnv();
  }

  async enforce(
    toolName: string,
    params: EnforceParams,
    sessionId: string
  ): Promise<true> {
    // Step 1: blocklist
    if (this.policy.blocklist.includes(toolName)) {
      await this.report(toolName, 'tool_blocked', 'critical', { tool: toolName, session: sessionId });
      throw new ToolBlockedError(toolName);
    }

    // Step 2: dangerous shell commands
    if (toolName === 'shell-exec' && typeof params.command === 'string') {
      const matched = this.policy.dangerousCommands.find(re => re.test(params.command as string));
      if (matched) {
        await this.report(toolName, 'dangerous_command_blocked', 'critical', {
          command_preview: (params.command as string).slice(0, 100),
          pattern: matched.toString(),
          session: sessionId,
        });
        throw new DangerousCommandError(params.command as string, matched.toString());
      }
    }

    // Step 3: rate limiting via Redis
    await this.enforceRateLimit(sessionId);

    // Step 4: confirmation gate
    if (
      this.policy.requireConfirmList.includes(toolName) &&
      params._confirmed !== true
    ) {
      // Not a security event. Just throw so Carina can ask the user.
      throw new ConfirmationRequiredError(toolName);
    }

    return true;
  }

  private async enforceRateLimit(sessionId: string): Promise<void> {
    const minuteKey = `scout:rate:${sessionId}:minute`;
    const hourKey   = `scout:rate:${sessionId}:hour`;

    // Use a pipeline so both INCR+EXPIRE operations are atomic per key.
    const pipeline = this.redis.pipeline();
    pipeline.incr(minuteKey);
    pipeline.expire(minuteKey, 60, 'NX'); // set TTL only if key is new
    pipeline.incr(hourKey);
    pipeline.expire(hourKey, 3600, 'NX');
    const results = await pipeline.exec();

    // results: [[err, minuteCount], [err, 1/0], [err, hourCount], [err, 1/0]]
    const minuteCount = results?.[0]?.[1] as number ?? 0;
    const hourCount   = results?.[2]?.[1] as number ?? 0;

    if (minuteCount > this.policy.rateLimit.callsPerMinute) {
      await this.report('rate-limit', 'rate_limit_exceeded', 'warning', {
        window: 'minute',
        count: minuteCount,
        limit: this.policy.rateLimit.callsPerMinute,
        session: sessionId,
      });
      throw new RateLimitError('minute', this.policy.rateLimit.callsPerMinute);
    }

    if (hourCount > this.policy.rateLimit.callsPerHour) {
      await this.report('rate-limit', 'rate_limit_exceeded', 'warning', {
        window: 'hour',
        count: hourCount,
        limit: this.policy.rateLimit.callsPerHour,
        session: sessionId,
      });
      throw new RateLimitError('hour', this.policy.rateLimit.callsPerHour);
    }
  }

  private async report(
    toolName: string,
    eventType: string,
    severity: SecurityEvent['severity'],
    metadata: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.reportFn({
        instance_id: process.env.LABYRINTH_INSTANCE_ID ?? 'unknown',
        event_type: eventType,
        severity,
        metadata: { tool: toolName, ...metadata },
      });
    } catch {
      // Reporting failure must never block tool policy enforcement.
    }
  }
}
```

Notes on Redis pipeline usage:
- `expire` with `'NX'` flag (Redis 7+) sets TTL only if the key does not already have one.
  This preserves the sliding window across multiple increments without resetting on every call.
- If the Redis pipeline fails (network error), let the error propagate up. Treat a Redis
  outage as a blocker: fail closed on rate limiting (safer than silently allowing unlimited calls).
  If this is too strict for the product, add a try/catch around `pipeline.exec()` and fall
  through. Document the decision either way.

---

### 2. Integration in Carina: `src/agents/tool-runner.ts`

Import the enforcer. Construct one instance at module level (singleton pattern, not per-call).

```typescript
import Redis from 'ioredis';
import { ToolPolicyEnforcer, ToolBlockedError, DangerousCommandError, RateLimitError, ConfirmationRequiredError } from '../../labyrinthscout/src/security/tool-policy.js';
import { scoutReportFn } from '../security/scout-reporter.js'; // from prompt 03

const enforcer = process.env.LABYRINTH_ENABLED === 'true'
  ? new ToolPolicyEnforcer(sharedRedis, scoutReportFn)
  : null;
```

Where `sharedRedis` is the existing ioredis client already used by Carina (not the subscriber
connection from the kill switch - that one is separate). Reuse the existing client.

In the tool execution function, before calling the tool handler:

```typescript
if (enforcer) {
  try {
    await enforcer.enforce(call.toolName, call.params, sessionId);
  } catch (err) {
    if (
      err instanceof ToolBlockedError ||
      err instanceof DangerousCommandError ||
      err instanceof RateLimitError ||
      err instanceof ConfirmationRequiredError
    ) {
      // Return as a tool result so the LLM can relay it to the user.
      return { error: err.message, code: err.code };
    }
    throw err; // unexpected error, re-throw
  }
}
// Proceed with normal tool execution.
```

This means the LLM sees the policy error as a tool result and can explain it to the user in
natural language. The error never crashes the agent turn.

---

### 3. Scout: Expose policy via API (read-only endpoint)

Add to the Scout Express app:

```typescript
// GET /api/policy
// Header: X-Scout-Key required
// Returns the active policy (omit the dangerousCommands regexes - return their .source strings)
```

Useful for the dashboard to display what policy is active. Returns 200 with:

```json
{
  "allowlist": ["web-search", "file-read"],
  "requireConfirmList": ["file-write", "email-send"],
  "blocklist": [],
  "rateLimit": { "callsPerMinute": 15, "callsPerHour": 200 },
  "dangerousCommandPatterns": ["rm\\s+(-rf?...", "dd\\s+if=", "..."]
}
```

Implement in `labyrinthscout/src/api/policy.ts`. Mount as `GET /api/policy`. Require
`X-Scout-Key` auth as per the existing kill switch API pattern.

---

## Environment Variables (add to `.env.example`)

```
# Tool Policy (Carina side)
SCOUT_BLOCKLIST=                    # comma-separated tool names, e.g. shell-exec,code-exec
SCOUT_RATE_LIMIT_MINUTE=15
SCOUT_RATE_LIMIT_HOUR=200
```

---

## Test Cases

Write as Vitest tests in `labyrinthscout/src/security/__tests__/tool-policy.test.ts`.
Use a mock Redis client (use ioredis-mock or manual mock with jest.fn()).
Use a mock reportFn that records calls.

**Test 1 - Blocked tool:**
Blocklist: `['shell-exec']`. Call `enforce('shell-exec', {}, 'session-1')`.
Expect: `ToolBlockedError` thrown. `reportFn` called once with `event_type: 'tool_blocked'`,
`severity: 'critical'`.

**Test 2 - Dangerous command (absolute path rm -rf):**
Call `enforce('shell-exec', { command: 'rm -rf /var/log/carina' }, 'session-1')`.
Expect: `DangerousCommandError` thrown. `reportFn` called with `event_type: 'dangerous_command_blocked'`.

**Test 3 - Dangerous command (relative path rm, not a system path):**
Call `enforce('shell-exec', { command: 'rm -rf /tmp/test-output' }, 'session-1')`.
Note: `/tmp/test-output` still starts with `/`, so `rm -rf /` pattern matches.
Expect: `DangerousCommandError`. Confirm the pattern `rm\s+(-rf?...` is the one that fires.

**Test 4 - Safe shell command passes:**
Call `enforce('shell-exec', { command: 'ls /tmp' }, 'session-1')`.
No dangerous pattern matches. Rate limit not exceeded. Tool not blocked. Not in confirmList.
Expect: resolves to `true` without throwing.

**Test 5 - Rate limit: 16 calls in one minute:**
Mock Redis pipeline to return incrementing counts. On the 16th call, minute count = 16.
Expect: `RateLimitError` thrown with 'minute' in message. `reportFn` called with
`event_type: 'rate_limit_exceeded'`, `severity: 'warning'`.

**Test 6 - Confirmation gate: file-write without _confirmed:**
Call `enforce('file-write', { path: '/tmp/out.txt', content: 'hello' }, 'session-1')`.
Expect: `ConfirmationRequiredError` thrown. `reportFn` NOT called (confirmation is UX, not security).

**Test 7 - Confirmation gate: file-write with _confirmed=true:**
Call `enforce('file-write', { path: '/tmp/out.txt', content: 'hello', _confirmed: true }, 'session-1')`.
Expect: resolves to `true`. No error. `reportFn` not called.

**Test 8 - LABYRINTH_ENABLED=false:**
Set `process.env.LABYRINTH_ENABLED = 'false'`. In Carina's tool-runner, `enforcer` should be
`null`. Verify by spying on `ToolPolicyEnforcer.enforce`: it should never be called.
The blocked tool should execute normally when the enforcer is null.

---

## Coding Standards

- `DEFAULT_POLICY` is a module-level const, frozen: `Object.freeze(DEFAULT_POLICY)`.
  Callers must not mutate it.
- `loadPolicyFromEnv()` returns a new object every time it is called; call it once at module
  init and store the result.
- Redis keys follow the pattern `scout:rate:{sessionId}:{window}`. Never use user-controlled
  strings directly as key segments without sanitisation. `sessionId` must be validated as
  alphanumeric + hyphens before use as a Redis key segment:
  ```typescript
  if (!/^[a-zA-Z0-9-_]{1,128}$/.test(sessionId)) {
    throw new Error('Invalid sessionId for rate limit key');
  }
  ```
- `dangerousCommands` patterns in the default policy are intentionally conservative. Do not
  remove any. Operators who need to allow a pattern should use a custom policy object, not
  edit the defaults.
- The enforcer constructor accepts an optional `policy` parameter. This makes it fully
  testable without touching env vars.
- All four error classes must set `this.name` explicitly (as shown) so `instanceof` checks
  work correctly across module boundaries in Node.js ESM.
- TypeScript strict mode. No `any`. The pipeline `results` array typing from ioredis is
  `Array<[Error | null, unknown]> | null`; handle null safely.
- `enforce()` steps must execute in order 1-4 and short-circuit on the first failure. Do not
  check rate limits before checking the blocklist.
- `ConfirmationRequiredError` is a UX concern, not a security concern. It must never appear
  in Scout's security events table and must never page an operator. Keep it cleanly separated
  from the three security errors.
