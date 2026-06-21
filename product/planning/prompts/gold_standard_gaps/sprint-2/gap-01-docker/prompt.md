# Gap 4: Multi-Service Docker Supervision; Full Build Prompt

**Status: SUPERSEDED - See gap-13-docker-migration/ for the implemented Docker migration. All goals from this prompt are met.**

> **REUSE RULE:** See `REUSE-RULES.md` in this directory. Implement the behavior described below in Carina's own voice. No competitor product names, labels, CLI output, or UI copy may appear verbatim in shipped code.


**Date revised:** 2026-06-18
**Status:** Partial (Docker exists with supervisord for hub; core/gateway/web have no supervisor configs)
**Reference agent:** Hermes Agent (full s6-overlay supervision tree)
**Existing code:** `docker/` directory in Carina core

> Read `00-PRE-WORK-ALIGNMENT.md` Gap 4 section before starting.
>
> CONFIRMED STATE:
>   docker/Dockerfile.carina; exists, multi-stage build
>   docker/docker-entrypoint.sh; exists
>   docker/nginx/; exists (multiple nginx configs)
>   docker/postgres/; exists
>   docker/supervisor/carina-hub.conf; exists (hub only)
>   docker-compose.yml; exists at repo root (dev stack: postgres + redis)
>   docker-compose.prod.yml; exists at repo root
>   docker-compose.verlox.yml; exists (VERLOX full stack)
>
> MISSING:
>   docker/supervisor/carina-core.conf
>   docker/supervisor/carina-gateway.conf
>   docker/supervisor/carina-web.conf
>   Docker HEALTHCHECK directive in Dockerfile.carina
>
> DECISION REQUIRED before starting:
>   Option A (FAST): Add supervisor configs for core/gateway/web. Use carina-hub.conf as template. 2-3 days.
>   Option B (CLEAN): Migrate to s6-overlay per this prompt. 1 week. Better long-term.
>   Recommendation: If shipping within 3 days, choose Option A. Otherwise, Option B is worth it.
>
> This prompt documents Option B (s6-overlay). If you choose Option A, use carina-hub.conf as
> your template and add the HEALTHCHECK from section 6 below. Skip the rest.

---

## SPECIFICATION

### What Already Exists
```
docker/
  (basic Dockerfile and/or docker-compose.yml)
```

### What Hermes Has (Study Reference)
```
hermes-agent/docker/
├── Dockerfile
├── entrypoint.sh; container entrypoint
├── main-wrapper.sh; main process wrapper
├── stage2-hook.sh; stage 2 initialization
├── hermes-exec-shim.sh; exec shim for s6
├── SOUL.md; container-specific persona
├── cont-init.d/
│   ├── 02-reconcile-profiles; profile reconciliation
│   └── 015-supervise-perms; permission setup
└── s6-rc.d/
    ├── main-hermes/
    │   ├── type; service type (longrun)
    │   ├── run; main process runner
    │   └── dependencies.d/
    │       └── base; depends on base
    ├── dashboard/
    │   ├── type
    │   ├── run
    │   ├── finish; cleanup on exit
    │   └── dependencies.d/
    │       └── base
    └── user/
        ├── contents.d/
        │   ├── main-hermes; include main-hermes
        │   └── dashboard; include dashboard
        └── dependencies.d/
            └── base
```

---

## FEATURES; ADOPT FROM HERMES s6-OVERLAY

### 1. s6-overlay Supervision Tree

**Architecture:**
```
s6-svscan (PID 1)
  ├── s6-linux-init (system init)
  ├── cont-init.d/ (one-shot initialization scripts)
  │   ├── 01-permissions
  │   ├── 02-reconcile-profiles
  │   ├── 03-migrate-state
  │   └── 04-health-check-setup
  └── user/
      └── contents.d/
          ├── carina-core/; main Carina agent
          ├── carina-gateway/; gateway service
          ├── carina-web/; web dashboard
          └── carina-cron/; cron scheduler
```

**Service definitions:**
```
carina-core/         (type: longrun)
  → Carina agent core process
  → Depends on: base, postgres-ready, redis-ready

carina-gateway/      (type: longrun)
  → Carina gateway (channel connections)
  → Depends on: carina-core

carina-web/          (type: longrun)
  → Web dashboard server
  → Depends on: carina-core

carina-cron/         (type: longrun)
  → Cron scheduler
  → Depends on: carina-core
```

### 2. Dockerfile (Multi-stage)

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine AS runner
# Install s6-overlay
ARG S6_OVERLAY_VERSION=3.2.0.0
ADD https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz /tmp
ADD https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-x86_64.tar.xz /tmp
RUN tar -C / -Jxpf /tmp/s6-overlay-noarch.tar.xz && \
    tar -C / -Jxpf /tmp/s6-overlay-x86_64.tar.xz && \
    rm /tmp/s6-overlay-*.tar.xz

# Install runtime dependencies
RUN apk add --no-cache \
    git openssh curl bash \
    python3 py3-pip \
    chromium chromium-chromedriver \
    postgresql-client redis

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json .

# Copy s6 service definitions
COPY docker/s6-rc.d/ /etc/s6-overlay/s6-rc.d/
COPY docker/cont-init.d/ /etc/s6-overlay/s6-rc.d/

# Create Carina data directory
RUN mkdir -p /data/carina && chown -R node:node /data/carina

# Switch to non-root user
USER node

EXPOSE 3333 4001 8080

ENTRYPOINT ["/init"]
```

### 3. Entrypoint & Init Scripts

**`docker/entrypoint.sh`:**
```bash
#!/command/with-contenv bash
# Carina container entrypoint
# Sets up environment, validates config, then hands off to s6

set -e

export CARINA_HOME="${CARINA_HOME:-/data/carina}"
export CARINA_ENV="${CARINA_ENV:-production}"

# Validate required env vars
if [ -z "$CARINA_DB_HOST" ]; then
  echo "ERROR: CARINA_DB_HOST is required"
  exit 1
fi

# Wait for dependencies
echo "Waiting for PostgreSQL..."
until pg_isready -h "$CARINA_DB_HOST" -p "${CARINA_DB_PORT:-5432}"; do
  sleep 2
done

echo "Waiting for Redis..."
until redis-cli -h "$CARINA_REDIS_HOST" ping; do
  sleep 2
done

echo "Carina environment ready"
exec /init
```

**`docker/cont-init.d/01-permissions`:**
```bash
#!/command/with-contenv bash
# Ensure correct permissions on data directories
chown -R node:node /data/carina
chmod 700 /data/carina/credentials 2>/dev/null || true
```

**`docker/cont-init.d/02-reconcile-profiles`:**
```bash
#!/command/with-contenv bash
# Reconcile Carina profiles on container start
# Ensures profiles from config match running state
cd /app
node dist/cli/entrance.js profile reconcile --all
```

**`docker/cont-init.d/03-migrate-state`:**
```bash
#!/command/with-contenv bash
# Run any pending database migrations
cd /app
node dist/cli/entrance.js doctor --fix --non-interactive
```

**`docker/cont-init.d/04-health-check-setup`:**
```bash
#!/command/with-contenv bash
# Create health check endpoint marker
mkdir -p /data/carina/health
echo "initializing" > /data/carina/health/status
```

### 4. Service Definitions

**`docker/s6-rc.d/carina-core/type`:**
```
longrun
```

**`docker/s6-rc.d/carina-core/run`:**
```bash
#!/command/with-contenv bash
# Main Carina agent core service
cd /app
exec s6-setuidgid node node dist/index.js \
  --mode core \
  --data-dir /data/carina
```

**`docker/s6-rc.d/carina-core/dependencies.d/base`:**
(empty file; signals dependency on base system)

**`docker/s6-rc.d/carina-core/dependencies.d/postgres`:**
(empty file)

**`docker/s6-rc.d/carina-core/finish`:**
```bash
#!/command/with-contenv bash
# Cleanup on core service exit
echo "Carina core exited with code $1"
echo "error" > /data/carina/health/status
```

**`docker/s6-rc.d/carina-gateway/run`:**
```bash
#!/command/with-contenv bash
# Carina gateway service (Telegram, Discord, Slack, etc.)
cd /app
exec s6-setuidgid node node dist/server.js \
  --mode gateway \
  --data-dir /data/carina
```

**`docker/s6-rc.d/carina-gateway/dependencies.d/carina-core`:**
(empty file)

**`docker/s6-rc.d/carina-web/run`:**
```bash
#!/command/with-contenv bash
# Web dashboard server
cd /app
exec s6-setuidgid node node dist/packages/web/dist/web-server.js \
  --port 8080 \
  --data-dir /data/carina
```

**`docker/s6-rc.d/carina-cron/run`:**
```bash
#!/command/with-contenv bash
# Cron scheduler
cd /app
exec s6-setuidgid node node dist/agents/cron-scheduler.js \
  --data-dir /data/carina
```

**`docker/s6-rc.d/user/contents.d/carina-core`:**
(empty file; include carina-core in user bundle)

**`docker/s6-rc.d/user/contents.d/carina-gateway`:**
(empty file)

**`docker/s6-rc.d/user/contents.d/carina-web`:**
(empty file)

**`docker/s6-rc.d/user/contents.d/carina-cron`:**
(empty file)

### 5. Docker Compose (Multi-Service)

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: carina
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: carina
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U carina"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  carina:
    build: .
    ports:
      - "3333:3333"    # Core API
      - "4001:4001"    # Gateway
      - "8080:8080"    # Web dashboard
    environment:
      CARINA_DB_HOST: postgres
      CARINA_DB_PORT: 5432
      CARINA_DB_USER: carina
      CARINA_DB_PASSWORD: ${DB_PASSWORD}
      CARINA_DB_NAME: carina
      CARINA_REDIS_HOST: redis
      CARINA_HOME: /data/carina
      CARINA_ENV: production
    env_file:
      - .env.production
    volumes:
      - carina_data:/data/carina
      - ./brain:/data/carina/brain:ro     # read-only brain files
      - ./skills:/data/carina/skills:ro   # read-only skills
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  carina_data:
```

### 6. Health Checks

**`docker/healthcheck.sh`:**
```bash
#!/bin/sh
# Docker health check for Carina
# Called by Docker's HEALTHCHECK instruction

# Check core API
if ! curl -sf http://localhost:3333/health > /dev/null 2>&1; then
  exit 1
fi

# Check gateway
if ! curl -sf http://localhost:4001/health > /dev/null 2>&1; then
  exit 1
fi

exit 0
```

**Add to Dockerfile:**
```dockerfile
COPY docker/healthcheck.sh /usr/local/bin/carina-healthcheck
RUN chmod +x /usr/local/bin/carina-healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD /usr/local/bin/carina-healthcheck
```

### 7. Logging

```
s6-overlay handles log rotation automatically via s6-log.
Each service gets its own log directory:

/data/carina/logs/
├── carina-core/
│   └── current; core agent logs
├── carina-gateway/
│   └── current; gateway logs
├── carina-web/
│   └── current; web dashboard logs
└── carina-cron/
    └── current; cron scheduler logs
```

To view logs:
```bash
docker exec carina s6-logwatch /data/carina/logs/carina-core
```

---

## IMPLEMENTATION PHASES

### Phase 1; Basic s6-overlay (Day 1-2)
```
- Install s6-overlay in Dockerfile
- Create service definitions for carina-core
- Create entrypoint.sh
- Create cont-init.d scripts
- Test container startup and shutdown
```

### Phase 2; Multi-Service (Day 3-4)
```
- Add carina-gateway service
- Add carina-web service
- Add carina-cron service
- Add service dependencies
- Test service restart on failure
```

### Phase 3; Docker Compose (Day 5-6)
```
- Create docker-compose.yml with PostgreSQL and Redis
- Configure service dependencies (wait for DB)
- Add health checks
- Test full stack startup
```

### Phase 4; Production Hardening (Day 7-8)
```
- Non-root user execution
- Read-only file systems where possible
- Secret management (Docker secrets or env files)
- Resource limits (memory, CPU)
- Log rotation configuration
- Backup volume scripts
```

---

## REFERENCE FILES TO STUDY

```
hermes-agent/docker/
  Dockerfile
  entrypoint.sh
  main-wrapper.sh
  stage2-hook.sh
  hermes-exec-shim.sh
  cont-init.d/02-reconcile-profiles
  cont-init.d/015-supervise-perms
  s6-rc.d/main-hermes/run
  s6-rc.d/main-hermes/type
  s6-rc.d/dashboard/run
  s6-rc.d/dashboard/finish
```