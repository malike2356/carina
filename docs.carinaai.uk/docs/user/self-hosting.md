# Self-Hosting

:::tip Canonical inventory
What ships in the npm package vs what you must configure: [Capability inventory](/docs/capabilities).
:::

Run Carina on your own infrastructure with Docker or bare Node.js, so the agent works on your stack.

## Docker (production stack)

`docker-compose.prod.yml` runs Carina web, Skills Hub, Postgres (pgvector), Redis, and nginx:

```bash
cd core.carinaai.uk
cp .env.example .env   # fill secrets locally, never commit
export DB_PASSWORD=your_strong_password
docker compose -f docker-compose.prod.yml up -d
```

Services:

| Service | Role |
|---|---|
| `carina-web` | Agent + web gateway on port 3000 (internal) |
| `carina-hub` | Skills Hub on port 3001 (internal) |
| `postgres` | pgvector/pgvector:0.8.0-pg16 |
| `redis` | Session and pub/sub |
| `nginx` | TLS termination, static docs, public site |

Post-deploy, ingest the property pack inside the web container or from a one-off job:

```bash
docker compose -f docker-compose.prod.yml exec carina-web node dist/src/skills/ingestion.js --pack property-uk
```

## Local development databases

`docker-compose.yml` exposes Postgres on **5433** and Redis on **6379**:

```bash
docker compose up -d postgres redis
```

Use:

```
DATABASE_URL=postgresql://carina:secret@localhost:5433/carina
REDIS_URL=redis://localhost:6379
```

## Carina + Scout (VERLOX stack)

For a combined Carina, Scout, and internal admin panel, use the overlay (not shipped to customers):

```bash
docker compose -f docker-compose.yml -f docker-compose.verlox.yml up -d
```

Set `LABYRINTH_ENABLED=true` in Carina and matching `SCOUT_API_KEY` on both sides. See [Labyrinth Scout](/docs/user/security/labyrinth-scout).

## npm global install

[`carina-agent`](https://www.npmjs.com/package/carina-agent) v0.1.0 on npm (Node.js 22+):

```bash
npm install -g carina-agent
carina setup
```

Then configure `~/.carina/.env` (wizard or manual) and start with `carina` or `carina web`.

## Bare metal (from source)

1. Install Node 22, Postgres 16 + pgvector, Redis 7, Docker (for shell/code tools).
2. `pnpm install && pnpm build` in `core.carinaai.uk`.
3. Configure `.env` with provider keys and `DATABASE_URL`.
4. `pnpm ingest` then `pnpm start` or `node dist/src/index.js`.

## TLS and domains

Production nginx config lives in `docker/nginx/carina-prod.conf`. Terminate TLS at nginx and proxy to `carina-web:3000`. Docs build output: `cd docs.carinaai.uk && pnpm build`, then mount `docs.carinaai.uk/build/` for `docs.carinaai.uk` or embed under `carinaai.uk/docs/` via `bash scripts/deploy-marketing.sh carina`.

## Health checks

- `GET /api/providers` on the web port should return configured providers.
- CLI: startup logs `Memory store ready` when Postgres is reachable.
- With Scout: dashboard shows instance heartbeat within 90 seconds.

## Security checklist

- Rotate `JWT_SECRET`, `SCOUT_API_KEY`, and DB passwords for production.
- Set `CORS_ORIGIN` to your real front-end origin.
- Do not expose `ops.carinaai.uk` admin; it is VERLOX-internal only.
- Enable Scout for prompt guard, egress filter, and kill switch on internet-facing deployments.
