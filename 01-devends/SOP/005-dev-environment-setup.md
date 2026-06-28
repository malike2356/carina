# SOP 005: Dev Environment Setup
**Classification:** Internal VERLOX only. Do not share externally.
**Source:** Migrated from planning/docs/dev-setup.md
**Last reviewed:** 2026-06-25

---

# Dev environment setup

## Local stack

The monorepo root is the Carina repo. Production runs via Docker on the VPS (80.190.81.208, SSH alias: `aman`).

### Prerequisites

- Node.js 22 LTS
- pnpm 11
- Docker + Compose plugin
- Python 3 (for deploy sync scripts)

### Start local Carina dev server

```bash
cd internal/servers/core.carinaai.uk
cp .env.example .env          # Fill in API keys
pnpm install --frozen-lockfile
pnpm dev                       # Starts on port 3333 (NOT 3000; 3000 is the prod container port)
```

### Start local Scout console

```bash
cd internal/servers/console.labyrinthscout.com
cp .env.example .env           # Fill in SCOUT_DB_PASSWORD, SCOUT_API_KEY, SCOUT_SESSION_SECRET
pnpm install --frozen-lockfile
pnpm dev                       # Starts on port 4444
```

### Start ops panel (optional)

```bash
cd internal/admin/ops.carinaai.uk
cp .env.example .env
pnpm install --frozen-lockfile
pnpm dev                       # Port 4000 (dev) - prod container uses port 4001
```

Set `CARINA_CORE_ENV_PATH=../../servers/core.carinaai.uk/.env` when core lives under `internal/servers/`.

### Start Aiva workspace UI (optional)

```bash
cd external/client-apps/app.carinaai.uk
cp .env.example .env
pnpm install --frozen-lockfile
pnpm dev                       # Port 4100
```

### Start supporting services (database + redis) via Docker

From `internal/servers/core.carinaai.uk/`:

```bash
docker compose up -d postgres redis
```

For full stack locally without TLS:

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.local.yml up
```

---

## Port map

| Service | Local port | Prod container | Prod URL |
|---------|-----------|----------------|----------|
| carina-web (pnpm dev) | 3333 | 3000 | core.carinaai.uk |
| carina-cloud (Aiva workspace Next.js) | 4100 | 4100 | app.carinaai.uk |
| carina-admin (Aiva admin Next.js) | 4200 | 4200 | admin.carinaai.uk |
| carina-hub | 3001 | 3001 | hub.carinaai.uk |
| carina-ops (ops Express/EJS) | 4000 | 4001 | ops.carinaai.uk |
| labyrinth-scout | 4444 | 4444 | console.labyrinthscout.com |
| scout-engine | 4455 | 4455 | internal only |
| postgres (local) | 5432 | internal | not public |
| redis (local) | 6379 | internal | not public |

In prod, no app service binds to a host port. Only the nginx container publishes 80 and 443.
Nginx proxies to app containers by Docker service name over the internal Docker network.

---

## .env setup

Minimum vars for local dev (copy from `.env.example` in each service directory):

**Carina core** (`internal/servers/core.carinaai.uk/.env`):

- `DATABASE_URL` - `postgresql://carina:secret@localhost:5432/carina`
- `REDIS_URL` - `redis://localhost:6379`
- At least one LLM provider key (Anthropic, DeepSeek, or OpenAI)
- `NODE_ENV=development`

**Scout** (`internal/servers/console.labyrinthscout.com/.env`):

- `SCOUT_DATABASE_URL` - `postgresql://scout:password@localhost:5432/scout`
- `REDIS_URL` - `redis://localhost:6379`
- `SCOUT_DB_PASSWORD` - same as password above
- `SCOUT_API_KEY` - any string for local dev
- `SCOUT_SESSION_SECRET` - any random string for local dev

Do NOT commit `.env` files. They are in `.gitignore`.

Note: DB migrations run inline via `src/memory/migrations.ts` through `runMigrations()` at startup. You do not run migration SQL files directly.

---

## Deploy path

1. Make changes locally
2. `git push` to `main` (or open a PR and merge to main)
3. CI runs tests on Linux, Windows, macOS
4. If CI passes: run the deploy script manually or let the deploy workflow trigger
   - rsyncs all service directories to VPS
   - SSH into VPS: runs `docker/scripts/deploy-prod.sh` (Carina) and `docker compose up` (Scout)
   - Health checks confirm services are live
5. Changes are live at prod domains within 3-5 minutes

Manual deploy (bypass CI):

```bash
bash scripts/deploy-carina.sh
# Or with overrides:
VPS_HOST=80.190.81.208 VPS_USER=malike APPS_ROOT=/home/malike/apps bash scripts/deploy-carina.sh
```

Marketing site only:

```bash
bash scripts/deploy-marketing.sh carina
```

New server bootstrap:

```bash
sudo bash scripts/bootstrap-server.sh
```

---

## Agent routing

When working as an AI agent on this repo:

| Change type | Directory |
|-------------|-----------|
| Carina backend/API | `internal/servers/core.carinaai.uk/src/` |
| Scout | `internal/servers/console.labyrinthscout.com/src/` |
| Aiva workspace UI (Next.js) | `external/client-apps/app.carinaai.uk/src/` |
| Aiva admin UI (Next.js) | `external/client-apps/admin.carinaai.uk/src/` |
| Ops panel (Express/EJS) | `internal/admin/ops.carinaai.uk/` |
| Docker/infra | `internal/servers/core.carinaai.uk/docker/` or `docker-compose.prod.yml` |
| Nginx config | `internal/servers/core.carinaai.uk/docker/nginx/` |
| Marketing sites | `marketing/sites/carinaai.uk/` or `marketing/sites/labyrinthscout.com/` |

After any infra change, update `internal/servers/core.carinaai.uk/docker/DEPLOY.md` or `SOP/002-deployment-guide.md`.
