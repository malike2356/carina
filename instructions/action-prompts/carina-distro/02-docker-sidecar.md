# Carina Distro Prompt 02: Docker Compose sidecar

## Goal

Configure Docker Compose so Carina runs as a supervised internal service alongside the
ABBIS API, web UI, PostgreSQL, and Redis. Carina is never reachable from the internet.
If Carina crashes, the supervisor restarts it from the already-installed code with no
version change and no network download.

## Context

Services in the ABBIS stack:

```
abbis360.com server
  docker network: abbis_internal
    abbis-api       port 3000 (exposed via nginx)
    carina          port 4500 (internal only - only abbis-api can reach it)
    postgres        port 5432 (internal only)
    redis           port 6379 (internal only)
  docker network: abbis_public
    nginx           ports 80, 443 (public)
```

Carina is on `abbis_internal` only. No route from `abbis_public` network reaches port
4500. The ABBIS API is the only caller of Carina; it does so over the internal Docker
network using the service hostname `carina`.

Restart policy for Carina: `restart: on-failure`. On crash, Docker restarts the container
from the same image (same pinned code, same pack, same version). No download. No version
change. The ABBIS API detects the restart window and returns graceful degraded responses
(implemented in prompt 03).

## Dependencies

`01-pin-carina-dependency.md`

## Files to create/modify

```
abbis/docker-compose.yml         (create - production stack)
abbis/docker-compose.dev.yml     (create - local dev overrides)
abbis/docker/nginx/abbis.conf    (create - reverse proxy)
abbis/docker/postgres/init.sql   (modify - ensure TimescaleDB bootstrap is correct)
```

## Step-by-step

### 1. Production Docker Compose

`abbis/docker-compose.yml`:
```yaml
version: '3.9'

networks:
  abbis_internal:
    driver: bridge
    internal: true
  abbis_public:
    driver: bridge

volumes:
  postgres_data:
  redis_data:

services:

  nginx:
    image: nginx:1.27-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/abbis.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    networks:
      - abbis_public
      - abbis_internal
    depends_on:
      - abbis-api
      - abbis-web

  abbis-api:
    build:
      context: .
      dockerfile: docker/api/Dockerfile
    restart: unless-stopped
    environment:
      NODE_ENV: production
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
      JWT_SECRET: ${JWT_SECRET}
      CARINA_INTERNAL_URL: http://carina:4500
      CARINA_API_KEY: ${CARINA_API_KEY}
      PAYSTACK_SECRET_KEY: ${PAYSTACK_SECRET_KEY}
      META_WHATSAPP_TOKEN: ${META_WHATSAPP_TOKEN}
      META_WHATSAPP_PHONE_NUMBER_ID: ${META_WHATSAPP_PHONE_NUMBER_ID}
      META_WHATSAPP_VERIFY_TOKEN: ${META_WHATSAPP_VERIFY_TOKEN}
    networks:
      - abbis_internal
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      carina:
        condition: service_started
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s

  abbis-web:
    build:
      context: .
      dockerfile: docker/web/Dockerfile
    restart: unless-stopped
    networks:
      - abbis_internal

  carina:
    build:
      context: .
      dockerfile: docker/carina/Dockerfile
    restart: on-failure
    environment:
      NODE_ENV: production
      CARINA_PORT: 4500
      ACTIVE_SKILL_PACKS: borehole-africa
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
      CARINA_API_KEY: ${CARINA_API_KEY}
      DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      LABYRINTH_ENABLED: "false"
    networks:
      - abbis_internal
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4500/health"]
      interval: 20s
      timeout: 5s
      retries: 5
      start_period: 30s

  postgres:
    image: timescale/timescaledb-ha:pg16
    restart: unless-stopped
    environment:
      POSTGRES_DB: abbis_db
      POSTGRES_USER: abbis
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    networks:
      - abbis_internal
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U abbis -d abbis_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - abbis_internal
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
```

Key decisions in this config:
- `restart: on-failure` for Carina (not `unless-stopped`): if Carina enters a crash
  loop, Docker backs off rather than thrashing indefinitely
- `restart: unless-stopped` for everything else: ABBIS API and nginx always restart
- Carina is only on `abbis_internal`; nginx has no route to port 4500
- `depends_on: carina: condition: service_started` (not `service_healthy`): ABBIS API
  starts even if Carina is still booting; graceful degradation (prompt 03) handles the
  window where Carina is not yet ready

### 2. Dev overrides

`abbis/docker-compose.dev.yml`:
```yaml
version: '3.9'

services:
  abbis-api:
    build:
      target: dev
    volumes:
      - ./apps/api/src:/app/apps/api/src:ro
    environment:
      NODE_ENV: development

  carina:
    environment:
      NODE_ENV: development
      ACTIVE_SKILL_PACKS: borehole-africa

  postgres:
    ports:
      - "5432:5432"

  redis:
    ports:
      - "6379:6379"
```

Run locally with:
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

Expose postgres and redis ports in dev so local tooling (Drizzle Studio, RedisInsight)
can connect. Never expose these ports in the base `docker-compose.yml`.

### 3. Nginx config

`abbis/docker/nginx/abbis.conf`:
```nginx
server {
    listen 80;
    server_name abbis360.com www.abbis360.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name abbis360.com www.abbis360.com;

    ssl_certificate     /etc/letsencrypt/live/abbis360.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/abbis360.com/privkey.pem;

    location /api/ {
        proxy_pass http://abbis-api:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://abbis-web:80;
        proxy_set_header Host $host;
    }
}
```

Note: port 4500 (Carina) does NOT appear in nginx config. Carina is internal-only.

### 4. Confirm postgres init

`abbis/docker/postgres/init.sql`:
```sql
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

## Expected behavior

```bash
docker compose up -d

# All services healthy:
docker compose ps
# NAME         STATUS      PORTS
# abbis-api    running     (healthy)
# carina       running     (healthy)
# postgres     running     (healthy)
# redis        running     (healthy)
# nginx        running     80->80, 443->443

# Carina NOT reachable from host:
curl http://localhost:4500/health   # connection refused

# ABBIS API reachable and knows Carina is up:
curl http://localhost:3000/api/health/carina   # {"carina": "ok"} (implemented in prompt 03)
```

Simulate Carina crash:
```bash
docker compose kill carina
# ABBIS API immediately returns degraded response on AI endpoints
docker compose ps carina   # watch it restart (on-failure policy)
# After restart: AI endpoints return normal responses again
```

## Test

```bash
docker compose up -d --build
docker compose ps          # all running
docker compose logs carina # "Carina agent running on port 4500"
docker compose exec abbis-api curl -s http://carina:4500/health   # reachable from API
curl -s http://localhost:80/api/health   # reachable from outside via nginx
```

## Pitfalls

- Do not set `CARINA_INTERNAL_URL` to `localhost` in production; use `http://carina:4500`
  (Docker service hostname)
- `timescale/timescaledb-ha:pg16` is the correct image for TimescaleDB 2.x on Postgres 16;
  plain `postgres:16` will not have TimescaleDB
- `restart: on-failure` will back off exponentially on repeated failures; if Carina is in
  a hard crash loop, check `docker compose logs carina` before assuming a platform issue
- Never bind Carina port 4500 to `0.0.0.0` in any compose file; it must only be reachable
  within the `abbis_internal` network
