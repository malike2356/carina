# Custom Agent Integration

Use the Scout HTTP API or official SDKs for any Node or Python agent.

## Quick start (Node)

```bash
npm install @verlox/labyrinth-scout
```

```typescript
import { LabyrinthScoutClient } from '@verlox/labyrinth-scout';

const scout = new LabyrinthScoutClient({
  url: 'http://localhost:4444',
  apiKey: process.env.SCOUT_API_KEY!,
  instanceId: 'my-agent-1',
  agentType: 'custom',
});

await scout.heartbeat();

const stop = scout.startKillSwitchPolling((reason) => {
  console.error('Suspended:', reason);
  process.exit(1);
});

// After each tool run:
await scout.reportToolCall({
  toolName: 'search',
  params: { q: 'test' },
  result: { hits: 3 },
  durationMs: 120,
  sessionId: 'sess-abc',
});

// On security incidents:
await scout.report({
  severity: 'warning',
  eventType: 'policy_violation',
  description: 'Blocked path /etc/passwd',
  sessionId: 'sess-abc',
});
```

See [Node SDK](/sdk/node) for all methods.

## Quick start (Python)

```bash
pip install labyrinth-scout
```

```python
from labyrinth_scout import LabyrinthScoutClient

scout = LabyrinthScoutClient(
    url="http://localhost:4444",
    api_key=os.environ["SCOUT_API_KEY"],
    instance_id="my-agent-1",
)

scout.heartbeat()
stop = scout.start_kill_switch_polling(on_suspend=lambda r: sys.exit(1))
scout.report_tool_call("search", {"q": "test"}, {"hits": 3}, 120)
```

## Authentication

All write endpoints require:

```
X-Scout-Key: <SCOUT_API_KEY>
```

## Instance ids

Use lowercase alphanumeric plus `_` and `-`, max 64 characters. One id per deployed agent process or tenant slice.

## Heartbeat

Call `heartbeat()` at least every 60 seconds so the dashboard shows **active** status.

## Full API reference

- [Events](/api/events)
- [Heartbeat](/api/heartbeat)
- [Kill switch](/api/kill-switch)
