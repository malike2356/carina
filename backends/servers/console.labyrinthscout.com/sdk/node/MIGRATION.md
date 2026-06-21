# Migration: @verlox/labyrinth-scout v0.2

The canonical SDK has moved to `labyrinth-scout-sdk/` at the repo root and is published
as `@verlox/labyrinth-scout` v0.2.

The v0.2 package is a superset of v0.1. All existing methods (`report`, `reportToolCall`,
`heartbeat`, `checkStatus`, `startKillSwitchPolling`) are available unchanged. The import
path and class name are identical.

## What changed

- Constructor accepts `instanceId` as optional (not required) when using the new API
- `heartbeat()` can be called with no arguments if `instanceId` was passed to constructor
- New capabilities: `policyEvaluate`, `policyContext`, `scoutWrap`, `scoutMiddleware`,
  `KillSwitchWatcher`, `KillSwitchSseWatcher`, `register`

## Migration

No code changes required. Install the new package and imports continue to work:

```bash
npm install @verlox/labyrinth-scout@^0.2
```

```typescript
// unchanged import
import { LabyrinthScoutClient } from '@verlox/labyrinth-scout';

const client = new LabyrinthScoutClient({
  url: process.env.SCOUT_URL!,
  apiKey: process.env.SCOUT_API_KEY!,
  instanceId: 'my-agent',
});

// all v0.1 methods still present
await client.report({ severity: 'info', eventType: 'startup', description: 'Agent started' });
const stop = client.startKillSwitchPolling((reason) => process.exit(1));
```

## Source

`labyrinth-scout-sdk/` in the repo root. This directory (`sdk/node/`) is the v0.1 archive
and is no longer maintained.
