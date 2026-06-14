# Node.js SDK

Package: `@verlox/labyrinth-scout`
Source: `labyrinth-scout-sdk/` (repo root)

## Install

```bash
npm install @verlox/labyrinth-scout
```

## Two integration styles

### Simple (telemetry + kill switch)

Use `LabyrinthScoutClient` if you only need to emit events and poll for suspension.
This is the v0.1 API, fully supported in v0.2.

```typescript
import { LabyrinthScoutClient } from '@verlox/labyrinth-scout';

const scout = new LabyrinthScoutClient({
  url: process.env.SCOUT_URL!,
  apiKey: process.env.SCOUT_API_KEY!,
  instanceId: 'my-agent-1',
  agentType: 'custom',
});

// Audit trail
await scout.report({
  severity: 'info',
  eventType: 'session_started',
  description: 'Agent session opened',
  sessionId: 'sess-abc',
});

// Kill switch polling
const stop = scout.startKillSwitchPolling((reason) => {
  console.error('Agent suspended:', reason);
  process.exit(1);
}, 30_000);
```

### Full governance (policy + wrap + middleware)

Use `ScoutClient` with `scoutWrap` or `scoutMiddleware` to enforce policy before each
LLM call or agent action.

```typescript
import { ScoutClient, scoutWrap, KillSwitchWatcher } from '@verlox/labyrinth-scout';
import OpenAI from 'openai';

const scout = new ScoutClient({
  url: process.env.SCOUT_URL!,
  apiKey: process.env.SCOUT_API_KEY!,
});

// Register and send heartbeats
const { instance_id } = await scout.register('Customer Support Bot', 'openai');
setInterval(() => scout.heartbeat(instance_id, 'Customer Support Bot'), 30_000);

// Kill switch
const watcher = new KillSwitchWatcher(scout, {
  instanceId: instance_id,
  onKill: async (reason) => { console.error('Kill switch fired:', reason); process.exit(0); },
});
watcher.start();

// Wrap LLM client: policy checked before every call
const openai = scoutWrap(new OpenAI(), { scout, provider: 'openai', instanceId: instance_id });

// Pre-action policy check
const decision = await scout.policyEvaluate({
  session_id: 'sess-abc',
  instance_id,
  tool_name: 'send_email',
  params: { to: 'external@corp.com' },
});
if (decision.decision === 'block') throw new Error(`Blocked: ${decision.reason}`);

// Audit
await scout.emit({
  event_type: 'tool_call',
  severity: 'info',
  source: instance_id,
  description: 'Email sent',
  session_id: 'sess-abc',
});
```

## Constructor options

### `LabyrinthScoutClient` / `ScoutClient` (same class, two export names)

| Option | Type | Required |
|---|---|---|
| `url` | string | Yes |
| `apiKey` | string | Yes |
| `instanceId` | string | No (bound to instance for v0.1 methods) |
| `agentType` | string | No (default `'custom'`) |
| `enabled` | boolean | No (default `true`; set `false` to disable all HTTP in tests) |
| `timeoutMs` | number | No (default `5000`) |

## Methods

### Telemetry (v0.1 compatible)

`report(event)` - emit a named event, fail-open on Scout outage
`reportToolCall(info)` - emit a `tool_call` event with tool metadata, fail-open
`heartbeat(instanceId?, name?)` - keep instance alive in Scout
`checkStatus()` - returns `{ suspended: boolean }`, fail-open on Scout outage
`startKillSwitchPolling(onSuspend, intervalMs?)` - polls instance status, returns stop fn

### Governance (v0.2)

`emit(event)` - emit an event, throws on HTTP error
`register(name, agentType?)` - provision a new instance, returns `{ instance_id }`
`instanceStatus(instanceId)` - get suspension status for a specific instance
`policyEvaluate(request)` - pre-action policy check, returns `PolicyDecision`
`policyContext(content, sessionId, options?)` - input content screening
`killSwitchStatus()` - global kill switch state
`streamUrlWithAuth()` - SSE stream URL with `?key=` appended for `EventSource`

### Wrappers

`scoutWrap(client, options)` - wraps any LLM client object with policy checks
`scoutMiddleware(options)` - Express middleware, screens incoming requests

### Kill switch watchers

`KillSwitchWatcher` - polls `/api/killswitch/status` at configurable interval
`KillSwitchSseWatcher` - subscribes to SSE stream for real-time kill switch events

## Error handling

`report()` and `reportToolCall()` catch network errors and log a warning - agent continues running.
`emit()`, `policyEvaluate()`, and `policyContext()` throw on HTTP errors.
`scoutMiddleware` and `scoutWrap` fail open when Scout is unreachable.
`KillSwitchWatcher` never fires `onKill` on Scout network errors (fail-safe).

## TypeScript exports

```typescript
import type {
  ScoutClientOptions,
  LabyrinthScoutClientOptions,
  ScoutEvent,
  PolicyDecision,
  PolicyEvaluateRequest,
  ReportEventOptions,
  ReportToolCallOptions,
  StatusResponse,
  Severity,
} from '@verlox/labyrinth-scout';
```

## Migrating from v0.1

No code changes required. The `LabyrinthScoutClient` class and all v0.1 methods are
preserved. See `sdk/node/MIGRATION.md` for details.
