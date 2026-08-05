# Carina + Scout Docker production (quick reference)

**Full step-by-step guide:** [`docs/DEPLOYMENT-GUIDE.md`](../../../../docs/DEPLOYMENT-GUIDE.md) at the repo root.

**Ops auth, user management, Scout accounts admin:** [`docs/OPS-USER-MANAGEMENT.md`](../../../../docs/OPS-USER-MANAGEMENT.md)

All runtime services run in Docker Compose. Nginx and certbot run inside Docker; nothing else should bind ports 80 or 443 on the host.

## Stack

| Service | Compose name | Public URL |
|---------|--------------|------------|
| Core API | carina-web | core.carinaai.uk |
| Skills Hub | carina-hub | hub.carinaai.uk |
| Ops panel | carina-ops | ops.carinaai.uk |
| Cloud UI | carina-cloud | app.carinaai.uk |
| Scout console | labyrinth-scout | console.labyrinthscout.com |
| Reverse proxy | nginx | all domains (80, 443) |

Scout connects to Carina nginx via the external `proxy` Docker network:

```bash
docker network create proxy   # once per server
```

## Deploy from laptop

```bash
export VPS_HOST=YOUR_SERVER_IP
export VPS_USER=YOUR_SSH_USER
bash scripts/deploy-carina.sh
```

## Deploy on server

```bash
cd /home/YOU/apps/core.carinaai.uk
export CARINA_OPS_CONTEXT=/home/YOU/apps/ops.carinaai.uk
export CARINA_CLOUD_CONTEXT=/home/YOU/apps/app.carinaai.uk
export CARINA_OPS_DOCKERFILE=docker/Dockerfile
export CARINA_CLOUD_DOCKERFILE=docker/Dockerfile
export CARINA_SSL_DIR=/etc/carina/ssl
bash docker/scripts/deploy-prod.sh

cd /home/YOU/apps/console.labyrinthscout.com
export SCOUT_ENGINE_CONTEXT=/home/YOU/apps/scout-engine
docker compose -f docker-compose.prod.yml up -d --build
```

## Env files (on server, never commit)

| File | Purpose |
|------|---------|
| `core.carinaai.uk/.env.docker.runtime` | Core secrets; `sync-docker-env.py` rewrites DB/Redis hosts |
| `core.carinaai.uk/.env.ops.runtime` | Ops secrets; `sync-ops-env.py` |
| `core.carinaai.uk/.env.cloud.runtime` | Cloud secrets; `sync-cloud-env.py` |
| `console.labyrinthscout.com/.env` | Scout secrets |

## Health checks

```bash
curl -fsS https://carinaai.uk/
curl -fsS https://core.carinaai.uk/health
curl -fsS https://hub.carinaai.uk/api/health
curl -fsS https://app.carinaai.uk/
curl -fsS https://console.labyrinthscout.com/api/health
docker compose -f docker-compose.prod.yml ps
```

## carinaai.uk marketing site (`public_website/`)

**Public URL:** `https://carinaai.uk/` is served by the **Docker `nginx` service**, not host aaPanel nginx on port 443.

| Path on VPS | Role |
|-------------|------|
| `core.carinaai.uk/public_website/` | Bind-mounted into nginx as `/var/www/public_website` (live marketing site) |
| `shared/marketing-sites/carinaai.uk/` | Git source; deploy with `bash scripts/deploy-marketing.sh carina` |

### Stale bind mount (403 Forbidden)

Docker bind mounts follow the **host directory inode**. If `public_website/` is deleted and recreated, or replaced without recreating nginx, the running container can see an **empty** mount. Symptoms:

- `curl https://carinaai.uk/` returns **403**
- `index.html` exists on the host under `public_website/`
- `docker exec … ls /var/www/public_website/` shows **empty**

**After any marketing rsync or change under `public_website/`, run:**

```bash
cd /home/YOU/apps/core.carinaai.uk
bash docker/scripts/reload-marketing-nginx.sh
```

`scripts/deploy-marketing.sh` and `scripts/deploy-carina.sh` call this automatically. If you rsync manually, run the script yourself.

### Do not

- Do not deploy marketing only to `/www/wwwroot/carinaai.uk` and expect `carinaai.uk` to update (legacy path; Docker uses `public_website/`).
- Do not `rm -rf public_website` then `mkdir` without recreating nginx.
- Prefer rsync into the existing `public_website/` directory.

See `public_website/README-DEPLOY.md` for a short copy agents can read in-tree.

## Move server

See [docs/DEPLOYMENT-GUIDE.md section 10](../../../../docs/DEPLOYMENT-GUIDE.md#10-move-to-a-new-server).

## Local dev with Docker (no SSL, ports exposed directly)

From `internal/servers/core.carinaai.uk/`:

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.local.yml up
```

Scout stack (separate directory):

```bash
cd internal/servers/console.labyrinthscout.com
docker compose -f docker-compose.prod.yml -f docker-compose.local.yml up
```

Services available at:

- http://localhost:3000 - Carina core API
- http://localhost:3001 - Skills hub
- http://localhost:4001 - Ops panel
- http://localhost:4100 - Cloud UI (Next.js)
- http://localhost:4444 - Scout console
- http://localhost:4455 - Scout engine

See also `docs/dev-setup.md` at the repo root for bare-metal dev ports.
