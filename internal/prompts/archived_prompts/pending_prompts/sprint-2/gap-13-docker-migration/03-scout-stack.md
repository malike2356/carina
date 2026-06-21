# Gap 13 - Prompt 03: Scout Stack - Production Compose File

**Status: COMPLETED 2026-06-21**

**Gap:** 13 Docker Migration
**Prompt number:** 03 of 05
**Name:** Scout Stack - Create docker-compose.prod.yml for Console and Engine
**Primary agent:** Claude Code
**Estimated hours:** 1-2 h
**Depends on:** Prompt 02 (Carina compose fixed, proxy network concept established)

## What was done

- Created `console.labyrinthscout.com/Dockerfile` - multi-stage build (deps, build, runner);
  pnpm-based; copies public/ assets into the image; exposes port 4444.
- Updated `scout-engine/Dockerfile` from runtime-only to multi-stage (builds TypeScript
  inside Docker); entry point is `dist/server.js`; exposes port 4455.
- Created `console.labyrinthscout.com/docker-compose.prod.yml` with:
  - `labyrinth-scout` container on port 4444, joined to `scout` + `proxy` networks
  - `scout-engine` container on port 4455, `scout` network only (internal)
  - Dedicated postgres (scout user/db) and redis for Scout
  - `:?` required-var enforcement on SCOUT_DB_PASSWORD, SCOUT_API_KEY, SCOUT_SESSION_SECRET
  - External `proxy` network (created once: `docker network create proxy`)
  - SCOUT_ENGINE_CONTEXT override for VPS absolute path
- Appended VPS deploy overrides to `.env.example`

---

## Read First

1. `/home/malike/apps/console.labyrinthscout.com/docker-compose.yml` - the dev compose (IN FULL)
2. `/home/malike/apps/scout-engine/docker-compose.yml` - the dev compose (IN FULL)
3. `/home/malike/apps/console.labyrinthscout.com/package.json` - check the port and start script
4. `/home/malike/apps/scout-engine/src/server.ts` or `src/index.ts` - check what port it listens on
5. Supervisor configs for current env vars:
   - `/etc/supervisor/conf.d/labyrinth-scout.conf`
   - `/etc/supervisor/conf.d/scout-engine.conf`

The supervisor configs contain the exact env vars passed to the running processes.
These become the basis for the compose `environment:` section.

---

## Context

Two bare-metal processes serve the Scout project:
- `labyrinth-scout` on port 4444 (the console: dashboard + API)
- `scout-engine` on port 4455 (internal event ingestion, not publicly exposed)

Both have development-oriented `docker-compose.yml` files that are not production-ready:
- The console compose builds inline with `dockerfile_inline` and uses a default port of 3001
- The scout-engine compose uses port 4444 and exposes Redis on the host

The target is a single `docker-compose.prod.yml` in the console repo
(`console.labyrinthscout.com/`) that:
- Runs labyrinth-scout on port 3001 (internal, no host binding)
- Runs scout-engine (internal only, no host binding, no external port)
- Has its own postgres and redis (private to the scout network)
- Joins the `proxy` external network so nginx can reach labyrinth-scout by service name

Scout-engine communicates with Scout's postgres directly and writes events to the
Scout database. Nginx does NOT proxy to scout-engine. It is internal only.

---

## Step 1: Read the supervisor configs to capture production env vars

SSH to VPS:
```bash
cat /etc/supervisor/conf.d/labyrinth-scout.conf
cat /etc/supervisor/conf.d/scout-engine.conf
```

List every environment variable found. These will be used in the compose file's
`environment:` section. Do not hardcode secret values - use `${VAR_NAME}` references
that will be populated from a `.env` file on the VPS.

---

## Step 2: Create console.labyrinthscout.com/docker-compose.prod.yml

The source path in the repo is:
`console.labyrinthscout.com/docker-compose.prod.yml`

```yaml
# Production compose for Labyrinth Scout console + engine.
# Requires the external 'proxy' Docker network to exist:
#   docker network create proxy
# The carina-web nginx container (in core.carinaai.uk stack) proxies
# console.labyrinthscout.com traffic to labyrinth-scout:3001 via the proxy network.

services:
  labyrinth-scout:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: scout-console
    expose:
      - "3001"
    environment:
      NODE_ENV: production
      SCOUT_PORT: ${SCOUT_PORT:-3001}
      SCOUT_DATABASE_URL: postgresql://scout:${SCOUT_DB_PASSWORD:?required}@postgres:5432/scout
      REDIS_URL: redis://redis:6379
      SCOUT_LICENSE_KEY: ${SCOUT_LICENSE_KEY:?required}
      SCOUT_API_KEY: ${SCOUT_API_KEY:?required}
      SCOUT_SESSION_SECRET: ${SCOUT_SESSION_SECRET:?required}
      SCOUT_PROXY_ENABLED: ${SCOUT_PROXY_ENABLED:-false}
      SCOUT_PROXY_PORT: ${SCOUT_PROXY_PORT:-8080}
      SCOUT_PROXY_KEY: ${SCOUT_PROXY_KEY:-}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - scout
      - proxy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s

  scout-engine:
    build:
      context: ${SCOUT_ENGINE_CONTEXT:-../scout-engine}
      dockerfile: Dockerfile
    container_name: scout-engine
    expose:
      - "4455"
    environment:
      NODE_ENV: production
      SCOUT_ENGINE_PORT: ${SCOUT_ENGINE_PORT:-4455}
      SCOUT_DATABASE_URL: postgresql://scout:${SCOUT_DB_PASSWORD:?required}@postgres:5432/scout
      REDIS_URL: redis://redis:6379
      SCOUT_ENGINE_API_KEY: ${SCOUT_ENGINE_API_KEY:-}
      SCOUT_CONSOLE_URL: http://labyrinth-scout:3001
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      labyrinth-scout:
        condition: service_healthy
    networks:
      - scout
    restart: unless-stopped

  postgres:
    image: pgvector/pgvector:0.8.0-pg16
    container_name: scout-postgres
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: scout
      POSTGRES_PASSWORD: ${SCOUT_DB_PASSWORD:?required}
      POSTGRES_DB: scout
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U scout"]
      interval: 5s
      timeout: 5s
      retries: 10
    networks:
      - scout
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: scout-redis
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    networks:
      - scout
    restart: unless-stopped

volumes:
  pgdata:
  redisdata:

networks:
  scout:
    driver: bridge
  proxy:
    external: true
    name: proxy
```

**Important - verify these before writing the file:**
- `SCOUT_PORT`: Check the supervisor conf. The bare-metal process listens on 4444.
  The console compose (dev version) defaults to 3001. Use whatever the app actually
  listens on. If it is 4444, change all references to 4444 in both the compose and
  in the nginx config from Prompt 01.
- `SCOUT_ENGINE_CONTEXT`: On the VPS this should be `/home/malike/apps/scout-engine`.
  Add `SCOUT_ENGINE_CONTEXT=/home/malike/apps/scout-engine` to the VPS `.env` file.
- Scout-engine port: Read the supervisor conf to confirm the actual port (currently 4455).

---

## Step 3: Check if console.labyrinthscout.com has a Dockerfile

The dev compose uses `dockerfile_inline`. The prod compose references `Dockerfile`.
Check:
```bash
ls /home/malike/apps/console.labyrinthscout.com/
```

If no `Dockerfile` exists, create one based on the `dockerfile_inline` content in the
dev compose, but using a named file:

`console.labyrinthscout.com/Dockerfile`:
```dockerfile
FROM node:22-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
EXPOSE 3001
CMD ["node", "dist/server.js"]
```

If a `Dockerfile` already exists, read it and verify it is correct before proceeding.

---

## Step 4: Create the Scout .env.example

Create `console.labyrinthscout.com/.env.example` (if it does not exist):

```
# Scout production environment variables
# Copy to .env on the VPS and fill in real values

SCOUT_PORT=3001
SCOUT_DB_PASSWORD=
SCOUT_LICENSE_KEY=
SCOUT_API_KEY=
SCOUT_SESSION_SECRET=
SCOUT_PROXY_ENABLED=false
SCOUT_PROXY_PORT=8080
SCOUT_PROXY_KEY=

# Build context override for VPS (absolute path to scout-engine repo)
SCOUT_ENGINE_CONTEXT=/home/malike/apps/scout-engine
SCOUT_ENGINE_PORT=4455
SCOUT_ENGINE_API_KEY=
```

---

## Step 5: Verify scout-engine Dockerfile

```bash
cat /home/malike/apps/scout-engine/Dockerfile
```

The existing `Dockerfile` was built for the dev compose. Check:
- Does it have a build step (`npm run build` or `tsc`)?
- Does the CMD start the compiled output (`node dist/server.js`)?
- Is the port correct?

If the Dockerfile is build-in-container style (compiles on build), it is correct for prod.
If it is a runtime-only Dockerfile that expects `dist/` pre-built, the VPS needs a build
step before `docker compose up`. Add a note to `04-cutover.md` Step 1 if this is the case.

---

## Verification

This prompt produces files only. No services are started yet.

```bash
# Verify the prod compose parses correctly (on the VPS or locally)
# The proxy network and Scout Postgres do not exist yet - that is expected.
cd /home/malike/apps/console.labyrinthscout.com
docker compose -f docker-compose.prod.yml config 2>&1 | head -20
```

Check for YAML errors only. Missing networks and missing upstream services are expected.

- [ ] `console.labyrinthscout.com/docker-compose.prod.yml` created
- [ ] `console.labyrinthscout.com/Dockerfile` exists (created or confirmed)
- [ ] `console.labyrinthscout.com/.env.example` created
- [ ] Port numbers verified against supervisor conf
- [ ] `docker compose -f docker-compose.prod.yml config` has no YAML errors
