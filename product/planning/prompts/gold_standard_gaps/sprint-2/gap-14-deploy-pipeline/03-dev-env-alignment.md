# Gap 14 - Prompt 03: Dev Environment Alignment Guide

**Gap:** 14 Deploy Pipeline
**Prompt number:** 03 of 03
**Name:** Local dev setup - how it maps to prod
**Primary agent:** Claude Code
**Estimated hours:** 1 h
**Depends on:** Prompts 01 and 02 done

---

## Context

Three AI agents (Cursor, Claude Code, Codex) work in parallel on this repo. New agents
start cold: they do not know which local ports map to which prod services, what .env vars
are required, or how a code change gets to prod. This prompt writes a concise dev guide.

---

## Goal

Create `docs/dev-setup.md` (checked into the repo) covering:

1. Local stack: how to start a working dev environment
2. Port map: which local port corresponds to which prod domain
3. .env setup: which vars must be set for local dev (not prod values, just which ones)
4. Deploy path: how a commit reaches prod

---

## What to write

Create `docs/dev-setup.md`:

```markdown
# Dev environment setup

## Local stack

The monorepo is at /opt/lampp/htdocs/verlox/carina (dev) and deployed via Docker to the VPS.

### Prerequisites

- Node.js 22 LTS
- pnpm 11
- Docker + Compose plugin
- Python 3 (for deploy sync scripts)

### Start local Carina dev server

cd internal/servers/core.carinaai.uk
cp .env.example .env          # Fill in API keys
pnpm install --frozen-lockfile
pnpm dev                       # Starts on port 3333 (NOT 3000 - 3000 is reserved for prod container)

### Start local Scout console

cd internal/servers/console.labyrinthscout.com
cp .env.example .env           # Fill in SCOUT_DB_PASSWORD, SCOUT_API_KEY, SCOUT_SESSION_SECRET
pnpm install --frozen-lockfile
pnpm dev                       # Starts on port 4444

### Start supporting services (database + redis) via Docker

From repo root:
docker compose up -d           # Starts postgres + redis for local dev
                               # Carina dev: postgres on localhost:5432
                               # Scout dev: also postgres on localhost:5432 (different DB)

---

## Port map

| Service | Local port | Prod service | Prod URL |
|---------|-----------|--------------|----------|
| carina-web (pnpm dev) | 3333 | carina-web Docker (expose 3000) | core.carinaai.uk |
| carina-cloud (Next.js) | 4100 | carina-cloud Docker (expose 4100) | app.carinaai.uk |
| carina-hub | 3001 | carina-hub Docker (expose 3001) | hub.carinaai.uk |
| carina-ops | 4001 | carina-ops Docker (expose 4001) | ops.carinaai.uk |
| labyrinth-scout | 4444 | labyrinth-scout Docker (expose 4444) | console.labyrinthscout.com |
| scout-engine | 4455 | scout-engine Docker (expose 4455) | internal only |
| postgres (local) | 5432 | postgres Docker (internal) | not public |
| redis (local) | 6379 | redis Docker (internal) | not public |

In prod, no app service binds to a host port. Only the nginx container publishes 80 and 443.
Nginx proxies to app containers by Docker service name over the internal Docker network.

---

## .env setup

Minimum vars for local dev (copy from .env.example in each service directory):

Carina core (internal/servers/core.carinaai.uk/.env):
  DATABASE_URL - postgres://carina:password@localhost:5432/carina
  REDIS_URL - redis://localhost:6379
  ANTHROPIC_API_KEY - (or any supported LLM provider key)
  NODE_ENV - development

Scout (internal/servers/console.labyrinthscout.com/.env):
  SCOUT_DATABASE_URL - postgresql://scout:password@localhost:5432/scout
  REDIS_URL - redis://localhost:6379
  SCOUT_DB_PASSWORD - (same as password above)
  SCOUT_API_KEY - any string for local dev
  SCOUT_SESSION_SECRET - any random string for local dev

Do NOT commit .env files. They are in .gitignore.

---

## Deploy path

1. Make changes locally
2. git push to main (or open a PR and merge to main)
3. GitHub Actions CI runs:
   - pnpm test on Linux, Windows, macOS
   - security audit, build check
4. If CI passes: GitHub Actions Deploy workflow triggers automatically
   - rsyncs all service directories to VPS
   - SSH into VPS: runs docker/scripts/deploy-prod.sh (Carina) and docker compose up (Scout)
   - Health checks confirm services are live
5. Changes are live at the prod domains within 3-5 minutes of CI passing

Manual deploy (bypass GitHub Actions):
  bash scripts/deploy-carina.sh

---

## Agent routing

When working as an AI agent on this repo:

- Carina backend/API changes: edit in internal/servers/core.carinaai.uk/src/
- Scout changes: edit in internal/servers/console.labyrinthscout.com/src/
- Cloud UI (Next.js) changes: edit in external/client-apps/app.carinaai.uk/src/
- Ops panel changes: edit in internal/admin/ops.carinaai.uk/
- Docker/infra changes: edit in internal/servers/core.carinaai.uk/docker/ or docker-compose.prod.yml
- Nginx config changes: edit in internal/servers/core.carinaai.uk/docker/nginx/
- Marketing site: edit in marketing/sites/carinaai.uk/ or marketing/sites/labyrinthscout.com/

After any infra change, update docker/DEPLOY.md to reflect the new state.
```

---

## Verification checklist

- [ ] `docs/dev-setup.md` created
- [ ] Port map table is accurate against current docker-compose files
- [ ] .env vars listed match actual .env.example files
- [ ] Deploy path description matches the GitHub Actions deploy.yml from Prompt 01
- [ ] Agent routing section lists correct paths for each service
