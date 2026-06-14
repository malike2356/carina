# labyrinth-scout-sdk

Governance SDK for connecting autonomous AI agents to a remote [Labyrinth Scout](https://labyrinthscout.com) instance.

Enterprise teams adopt Scout first for **audit trail and provability**: every agent action, policy decision, and operator intervention is recorded and searchable. Policy enforcement and the kill switch are layered on top of that record; they do not replace it.

## What you get

1. **Audit trail** - emit structured events (`tool_call`, `session_metrics`, custom types) to Scout's compliance log
2. **Governance** - register agent instances, heartbeats, and session linkage for accountability
3. **Policy enforcement** - pre-action screening via `scoutWrap` or Express `scoutMiddleware`
4. **Kill switch** - polling or SSE watchers that stop agents when operators trigger a global halt

## Install

```bash
npm install labyrinth-scout-sdk
```

## Quick start

```typescript
import { ScoutClient, scoutWrap, KillSwitchWatcher } from 'labyrinth-scout-sdk';
import OpenAI from 'openai';

const scout = new ScoutClient({ url: 'https://scout.myorg.com', apiKey: process.env.SCOUT_API_KEY! });

// Register this agent instance on startup
const { instance_id } = await scout.register('Customer Support Bot', 'openai');

// Send heartbeats every 30 seconds
setInterval(() => scout.heartbeat(instance_id, 'Customer Support Bot'), 30_000);

// Kill switch: gracefully stop if triggered (never kills on Scout network errors)
const watcher = new KillSwitchWatcher(scout, {
  instanceId: instance_id,
  onKill: async (reason) => {
    console.log('Scout kill switch triggered:', reason);
    process.exit(0);
  },
});
watcher.start();

// Wrap LLM client - policy block throws; Scout unreachable fails open
const openai = scoutWrap(new OpenAI(), { scout, provider: 'openai', instanceId: instance_id });

// Audit a completed action
await scout.emit({
  event_type: 'tool_call',
  severity: 'info',
  source: instance_id,
  description: 'Fetched customer record',
  metadata: { customerId: '12345' },
  session_id: 'sess-abc',
});
```

## Fail-open vs fail-safe behaviour

| Component | Scout unreachable | Policy block |
|-----------|-------------------|--------------|
| `scoutMiddleware` | Pass request through | 403 `policy_blocked` |
| `scoutWrap` | Pass request through | Throw before LLM call |
| `KillSwitchWatcher` | Do not trigger kill | N/A |

This is deliberate and asymmetric: blocking agent traffic because Scout is down is worse than a temporary governance gap, but killing an agent on a network glitch would also be bad.

## SSE kill switch

`KillSwitchSseWatcher` uses `GET /api/stream?key=` because browser `EventSource` cannot send `X-Scout-Key` headers. The Scout server validates the query key before opening the stream.

## Supported agent adapters

Built-in parsers for `openai`, `langchain`, `carina`, `hermes`, `openclaw`, and a `generic` fallback. Pass the provider name to `scoutWrap` or `scoutMiddleware`.

## License

MIT
