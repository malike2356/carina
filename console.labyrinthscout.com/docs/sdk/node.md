# Node.js SDK

Package: `@verlox/labyrinth-scout`  
Source: `console.labyrinthscout.com/sdk/node/`

## Install

```bash
npm install @verlox/labyrinth-scout
```

## Constructor

```typescript
import { LabyrinthScoutClient } from '@verlox/labyrinth-scout';

const client = new LabyrinthScoutClient({
  url: 'http://localhost:4444',
  apiKey: process.env.SCOUT_API_KEY!,
  instanceId: 'my-agent-1',
  agentType: 'custom',  // optional, default 'custom'
  enabled: true,        // optional, set false to no-op
});
```

| Option | Type | Required |
|---|---|---|
| `url` | string | Yes |
| `apiKey` | string | Yes |
| `instanceId` | string | Yes |
| `agentType` | string | No |
| `enabled` | boolean | No |

## Methods

### `report(event: ReportEventOptions): Promise<void>`

Posts to `/api/events`.

```typescript
await client.report({
  severity: 'critical',
  eventType: 'prompt_injection_detected',
  description: 'Layer 1: ignore-previous-instructions',
  sessionId: 'sess-1',
  metadata: { layer: 1 },
});
```

| Field | Type |
|---|---|
| `severity` | `'info' \| 'warning' \| 'critical' \| 'breach'` |
| `eventType` | string |
| `description` | string |
| `sessionId` | string (optional) |
| `metadata` | object (optional) |

### `reportToolCall(info: ReportToolCallOptions): Promise<void>`

Convenience wrapper for `event_type: tool_call`.

```typescript
await client.reportToolCall({
  toolName: 'http-request',
  params: { method: 'GET', url: 'https://api.example.com' },
  result: { status: 200 },
  durationMs: 450,
  sessionId: 'sess-1',
});
```

### `heartbeat(): Promise<void>`

Posts to `/api/heartbeat`. Call every 60 seconds in long-running processes.

### `checkStatus(): Promise<StatusResponse>`

```typescript
const { suspended, reason } = await client.checkStatus();
```

Returns `{ suspended: false }` when Scout is unreachable (fail-open for availability).

### `startKillSwitchPolling(onSuspend, intervalMs?): () => void`

```typescript
const stop = client.startKillSwitchPolling((reason) => {
  console.error('Agent suspended:', reason);
  process.exit(1);
}, 30_000);

// on shutdown:
stop();
```

Polls `GET /api/instances/:instanceId/status`. Default interval 30 seconds.

## Error handling

Network failures log a warning once and resolve without throwing (agent keeps running). Set `enabled: false` in tests to skip HTTP entirely.

## TypeScript exports

```typescript
export type {
  LabyrinthScoutClientOptions,
  ReportEventOptions,
  ReportToolCallOptions,
  StatusResponse,
  Severity,
};
```

## Build from monorepo

```bash
cd console.labyrinthscout.com/sdk/node
npm run build
```

Publish after version bump in `package.json`.
