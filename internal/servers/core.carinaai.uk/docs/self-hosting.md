# Self-Hosting

Run Carina on your own infrastructure with Docker or bare Node.js, so the agent works on your stack.

## Quick install (npm)

| Platform | Command |
|---|---|
| Linux / macOS | `curl -fsSL .../install.sh \| sh` or `npm install -g carina-agent` |
| Windows (PowerShell) | `powershell -ExecutionPolicy Bypass -File installer/install-windows.ps1` |
| Windows (cmd) | `install.cmd` |

First run:

```bash
carina              # interactive onboarding (name, focus, optional API key)
carina onboard      # guided setup + doctor
carina setup --full # advanced wizard (Postgres, Scout, packs)
```

Non-interactive (CI, Docker init):

```bash
carina onboard --skip-doctor
# or
node dist/src/setup/container-bootstrap.js
```

## Standalone Docker (single-user)

`docker-compose.standalone.yml` runs Carina with a persistent `/data` volume, tini supervision, and a health check on `/api/config`:

```bash
cd core.carinaai.uk
cp .env.docker.example .env.docker   # fill API keys locally, never commit
docker compose -f docker-compose.standalone.yml up -d --build
```

Open `http://127.0.0.1:3000` after the health check passes.

Optional profiles:

```bash
# Postgres + Redis memory backend
docker compose -f docker-compose.standalone.yml --profile postgres --profile redis up -d

# Local Ollama (CPU)
docker compose -f docker-compose.standalone.yml --profile ollama up -d

# NVIDIA GPU for Ollama
docker compose -f docker-compose.standalone.yml -f docker/gpu.nvidia.yml --profile ollama up -d
```

Single-file GPU stack (Portainer/Coolify):

```bash
docker compose -f docker-compose.gpu-nvidia.yml up -d --build
```

Container first boot:

- Creates `CARINA_HOME` (default `/data/.carina`) with `.env`, `config.yaml`, and workspace bootstrap files (`AGENTS.md`, `USER.md`, etc.)
- Copies operator profile from `CARINA_OPERATOR_NAME` / `CARINA_OPERATOR_CONTEXT` into `USER.md`
- Skips bootstrap when `CARINA_SKIP_CONTAINER_BOOTSTRAP=true`

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

Set `LABYRINTH_ENABLED=true` in Carina and matching `SCOUT_API_KEY` on both sides. See [Labyrinth Scout](/security/labyrinth-scout).

## Bare metal

1. Install Node 22, Postgres 16 + pgvector, Redis 7, Docker (for shell/code tools).
2. `pnpm install && pnpm build` in `core.carinaai.uk`.
3. Configure `.env` with provider keys and `DATABASE_URL`.
4. `pnpm ingest` then `pnpm start` or `node dist/src/index.js`.

## TLS and domains

Production nginx config lives in `docker/nginx/carina-prod.conf`. Terminate TLS at nginx and proxy to `carina-web:3000`. Docs build output can be mounted from `docs/.vitepress/dist` for `docs.carinaai.uk`.

## Health checks

- `GET /api/providers` on the web port should return configured providers.
- CLI: startup logs `Memory store ready` when Postgres is reachable.
- With Scout: dashboard shows instance heartbeat within 90 seconds.

## Security checklist

- Rotate `JWT_SECRET`, `SCOUT_API_KEY`, and DB passwords for production.
- Set `CORS_ORIGIN` to your real front-end origin.
- Do not expose `ops.carinaai.uk` admin; it is VERLOX-internal only.
- Enable Scout for prompt guard, egress filter, and kill switch on internet-facing deployments.
