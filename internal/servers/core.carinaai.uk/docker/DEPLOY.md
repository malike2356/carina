# Carina + Scout Docker production (fully containerised)

All runtime services - Carina, Labyrinth Scout, and nginx - run in Docker Compose.
There is no bare-metal nginx and no supervisor entries for any of these services.
Certbot renews TLS certificates on the host; nginx reads them via a bind mount.

## Stack

### Carina (core.carinaai.uk compose)

| Service | Compose name | Internal port | Public URL |
|---------|--------------|---------------|------------|
| Core API | carina-web | 3000 (expose only) | core.carinaai.uk |
| Skills Hub | carina-hub | 3001 (expose only) | hub.carinaai.uk |
| Ops panel | carina-ops | 4001 (expose only) | ops.carinaai.uk |
| Cloud UI | carina-cloud | 4100 (expose only) | app.carinaai.uk |
| Database | postgres | internal | - |
| Cache | redis | internal | - |
| Reverse proxy | nginx | 80, 443 (host) | all Carina + Scout domains |

### Labyrinth Scout (console.labyrinthscout.com compose)

| Service | Compose name | Internal port | Public URL |
|---------|--------------|---------------|------------|
| Scout console | labyrinth-scout | 4444 (expose only) | console.labyrinthscout.com |
| Scout engine | scout-engine | 4455 (expose only) | internal only |
| Database | scout-postgres | internal | - |
| Cache | scout-redis | internal | - |

The `proxy` external Docker network connects the nginx container (in the Carina stack)
to the `labyrinth-scout` container (in the Scout stack) so nginx can route
`console.labyrinthscout.com` without publishing Scout ports to the host.

## One-time server setup

```bash
# 1. Install Docker and the Compose plugin
# 2. Create the shared proxy network (once per server, not per deploy)
docker network create proxy

# 3. Obtain TLS certificates via certbot (host-level)
#    Certs land in /etc/carina/ssl/live/ (or /etc/letsencrypt/ symlinked there)
#    The nginx container mounts ${CARINA_SSL_DIR:-/etc/carina/ssl}

# 4. Place .env files:
#    /home/malike/apps/core.carinaai.uk/.env.docker.runtime  (Carina secrets)
#    /home/malike/apps/ops.carinaai.uk/.env                  (ops secrets)
#    /home/malike/apps/app.carinaai.uk/.env                  (cloud secrets)
#    /home/malike/apps/console.labyrinthscout.com/.env       (Scout secrets)
```

## Deploy (from carina repo root)

```bash
bash scripts/deploy-carina.sh
```

This script:
1. rsyncs core, ops, cloud, Scout console, and Scout engine to the VPS
2. Ensures the `proxy` Docker network exists
3. Runs `docker/scripts/deploy-prod.sh` for the Carina stack
4. Runs `docker compose -f docker-compose.prod.yml up -d --build` for the Scout stack

## Manual deploy on the server

```bash
# Carina stack
cd /home/malike/apps/core.carinaai.uk
export CARINA_OPS_CONTEXT=/home/malike/apps/ops.carinaai.uk
export CARINA_OPS_DOCKERFILE=docker/Dockerfile.runtime
export CARINA_CLOUD_CONTEXT=/home/malike/apps/app.carinaai.uk
export CARINA_CLOUD_DOCKERFILE=docker/Dockerfile
export CARINA_SSL_DIR=/etc/carina/ssl
bash docker/scripts/deploy-prod.sh

# Scout stack
cd /home/malike/apps/console.labyrinthscout.com
export SCOUT_ENGINE_CONTEXT=/home/malike/apps/scout-engine
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
```

## Env files (on server, never commit)

| File | Purpose |
|------|---------|
| `core.carinaai.uk/.env.docker.runtime` | Carina core secrets; `sync-docker-env.py` rewrites DB/Redis hosts |
| `core.carinaai.uk/.env.ops.runtime` | ops secrets; `sync-ops-env.py` |
| `core.carinaai.uk/.env.cloud.runtime` | cloud secrets; `sync-cloud-env.py` |
| `console.labyrinthscout.com/.env` | Scout secrets; used directly by compose |

## Moving to a new server

1. Install Docker and the Compose plugin.
2. Run `docker network create proxy`.
3. Install certbot; run `certbot certonly` for all domains; symlink or copy certs to `/etc/carina/ssl/`.
4. Clone or rsync each app repo to `/home/malike/apps/`.
5. Copy all `.env` and `.env.*.runtime` files (never in git).
6. In each stack directory, run `docker compose -f docker-compose.prod.yml up -d --build`.
7. Update DNS to point to the new server IP. Nginx starts serving immediately.

Postgres and Redis data live in named Docker volumes (`pgdata`, `redisdata` in each stack).
Back up these volumes before decommissioning the old server.

## Checking service health

```bash
# Carina
docker compose -f /home/malike/apps/core.carinaai.uk/docker-compose.prod.yml ps

# Scout
docker compose -f /home/malike/apps/console.labyrinthscout.com/docker-compose.prod.yml ps

# Verify domains
curl -fsS https://core.carinaai.uk/api/health
curl -fsS https://hub.carinaai.uk/api/health
curl -fsS https://app.carinaai.uk/
curl -fsS https://console.labyrinthscout.com/api/health
```
