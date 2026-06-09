# Carina Integration

Carina ships native Scout support; no SDK required.

## Environment

Add to Carina `.env` (or `~/.carina/.env`):

```bash
LABYRINTH_ENABLED=true
LABYRINTH_URL=http://localhost:4444
LABYRINTH_API_KEY=your_scout_key
LABYRINTH_INSTANCE_ID=carina-prod
LABYRINTH_INSTANCE_NAME=Carina Production
```

`LABYRINTH_API_KEY` must equal Scout `SCOUT_API_KEY`.

## Automatic behaviour

When enabled, Carina:

| Action | Interval / trigger |
|---|---|
| `POST /api/heartbeat` | Every 60 seconds |
| `POST /api/events` for tool calls | After each tool execution |
| Prompt guard on user input | Every message |
| Prompt guard on tool output | After HTTP/file tools |
| Session metrics (`session_metrics`) | Flushed periodically for anomaly detection |
| Kill switch listener | Redis channel `labyrinth:control` |
| Egress filter + tool policy | Enforced on HTTP and registry tools |

Suspended instances throw before the LLM runs:

```
Carina is suspended by Labyrinth Scout. Reason: ...
```

## Optional judge model

Layer-3 prompt guard calls an OpenAI-compatible router:

```
LABYRINTH_LLM_ROUTER_URL=http://localhost:3000
LABYRINTH_JUDGE_MODEL=deepseek/deepseek-chat
```

Point this at Carina web or any compatible gateway.

## Policy alignment

Set the same blocklist and rate limits on Carina as documented in [Tool Policy](/security/tool-policy). Carina reads `SCOUT_*` env vars client-side.

## Docker stack

Use `docker-compose.verlox.yml` overlay in `core.carinaai.uk` to run Carina and Scout on one network with shared Postgres and Redis.

## Carina docs

Agent setup and tools: [carinaai.uk/docs](https://carinaai.uk/docs/security/labyrinth-scout).
