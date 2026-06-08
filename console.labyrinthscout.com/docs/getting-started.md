# Getting Started

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 22+ |
| PostgreSQL | 16 with pgvector (shared schema with Carina is fine) |
| Redis | 7+ |
| pnpm | 9+ (from source) |

## Install (Docker)

```bash
docker run -d \
  --name scout \
  -p 4444:4444 \
  -e SCOUT_API_KEY="$(openssl rand -hex 32)" \
  -e SCOUT_DATABASE_URL=postgresql://user:pass@host:5432/scout \
  -e REDIS_URL=redis://host:6379 \
  verlox/scout:latest
```

## Install (from source)

```bash
cd console.labyrinthscout.com
cp .env.example .env
# Set SCOUT_API_KEY and SCOUT_DATABASE_URL
pnpm install
pnpm dev
```

Server listens on `http://localhost:4444`. Dashboard: `http://localhost:4444/dashboard.html`.

## Required environment variables

| Variable | Description |
|---|---|
| `SCOUT_API_KEY` | Shared secret; sent as `X-Scout-Key` on API calls |
| `SCOUT_DATABASE_URL` | Postgres connection (falls back to `DATABASE_URL`) |
| `REDIS_URL` | Pub/sub for SSE and kill-switch control channel |

Generate a key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

:::warning
Never commit `.env`. Rotate `SCOUT_API_KEY` if it leaks.
:::

## Connect your first agent (Carina)

Add to Carina `.env`:

```
LABYRINTH_ENABLED=true
LABYRINTH_URL=http://localhost:4444
LABYRINTH_API_KEY=<your SCOUT_API_KEY>
LABYRINTH_INSTANCE_ID=carina-local
```

Restart Carina. Within 60 seconds the dashboard **Instances** bar should show `carina-local` as **active**.

## Verify

1. Open `http://localhost:4444`.
2. Send a message through Carina that uses a tool.
3. Confirm a `tool_call` event appears in the live stream.

Optional: `curl -H "X-Scout-Key: $SCOUT_API_KEY" http://localhost:4444/api/status` returns instances and 24h stats.

## Next steps

- [Configuration](/configuration) - all env vars
- [Dashboard](/dashboard) - panel reference
- [Carina integration](/integration/carina) - native wiring
- [Events API](/api/events) - custom agents
