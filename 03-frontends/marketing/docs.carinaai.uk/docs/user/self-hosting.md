# Self-Hosting

:::tip Canonical inventory
What ships in the npm package vs what you must configure: [Capability inventory](/docs/capabilities).
:::

Run Carina on your own infrastructure. **Docker is optional**; bare metal Node.js works with a single command.
Docker is only required if you need the hosted and Scout multi-service orchestration stack.

---

## Bare metal (from source)

The fastest way to run Carina. You need Node.js 22+ and pnpm:

```bash
git clone https://github.com/malike2356/carina-mutant.git
cd carina-mutant
pnpm install
cp .env.example .env   # fill in your provider keys
pnpm dev               # agent is live
```

That's it. The agent starts with SQLite by default; no Postgres, no Redis, no Docker. Chat immediately.

For production persistence, add a database:

```bash
DATABASE_URL=postgresql://carina:pass@localhost:5432/carina
REDIS_URL=redis://localhost:6379
```

Then `pnpm build && pnpm start` (or `node dist/src/index.js`).

## npm global install

[`carina-agent`](https://www.npmjs.com/package/carina-agent) v0.1.1 on npm (Node.js 22+):

```bash
npm install -g carina-agent
carina setup
```

Configure `~/.carina/.env` (wizard or manual) and start with `carina` or `carina web`.

## Docker (optional; for Cloud/Scout multi-service)

Docker is only needed when you want the full multi-service stack: Postgres with pgvector, Redis, nginx TLS termination, Skills Hub, and Scout integration. Single-user self-hosted Carina does not need it.

```bash
cd core.carinaai.uk
cp .env.example .env
export DB_PASSWORD=your_strong_password
docker compose -f docker-compose.prod.yml up -d
```

Services:

- `carina-web`; Agent + web gateway on port 3000 (internal)
- `carina-hub`; Skills Hub on port 3001 (internal)
- `postgres`; pgvector/pgvector:0.8.0-pg16
- `redis`; Session and pub/sub
- `nginx`; TLS termination, static docs, public site

Post-deploy, ingest the property pack:

```bash
docker compose -f docker-compose.prod.yml exec carina-web node dist/src/skills/ingestion.js --pack property-uk
```

### Local dev databases

```bash
docker compose up -d postgres redis
# Postgres exposed on 5433, Redis on 6379
```

## Carina + Scout (VERLOX stack)

Combined Carina, Scout, and admin panel for VERLOX internal use, not shipped to customers:

```bash
docker compose -f docker-compose.yml -f docker-compose.verlox.yml up -d
```

Set `LABYRINTH_ENABLED=true` and matching `SCOUT_API_KEY` on both sides.

## Windows

```powershell
npm install -g carina-agent
carina setup
```

PowerShell direct shell mode works for local commands. Docker Desktop optional for stronger isolation.

## TLS and domains

Production nginx: `docker/nginx/carina-prod.conf`. Terminate TLS at nginx, proxy to `carina-web:3000`.

## Health checks

- `GET /api/providers`; should return configured providers
- CLI startup: `Memory store ready` when Postgres is reachable
- Scout: dashboard shows instance heartbeat within 90 seconds

## Security checklist

- Rotate `JWT_SECRET`, `SCOUT_API_KEY`, and DB passwords for production
- Set `CORS_ORIGIN` to your real front-end origin
- Do not expose `ops.carinaai.uk` admin (VERLOX-internal only)
- Enable Scout for prompt guard, egress filter, and kill switch on internet-facing deployments
