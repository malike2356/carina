# @verlox/labyrinth-scout

Official Node.js SDK for [Labyrinth Scout](https://labyrinthscout.com).

```typescript
import { LabyrinthScoutClient } from '@verlox/labyrinth-scout';

const scout = new LabyrinthScoutClient({
  url: process.env.LABYRINTH_URL!,
  apiKey: process.env.LABYRINTH_API_KEY!,
  instanceId: process.env.LABYRINTH_INSTANCE_ID ?? 'my-agent',
  agentType: 'custom',
});

const status = await scout.checkStatus();
if (status.suspended) throw new Error(`Agent suspended: ${status.reason}`);

await scout.reportToolCall({
  toolName: 'web-search',
  params: { query: 'UK base rate' },
  result: searchResults,
  durationMs: 342,
  sessionId: currentSessionId,
});

setInterval(() => void scout.heartbeat(), 60_000);

const stopPolling = scout.startKillSwitchPolling((reason) => {
  console.error(`Agent suspended by Labyrinth Scout: ${reason}`);
  process.exit(1);
});
```

All methods fail open: unreachable Scout never throws.
