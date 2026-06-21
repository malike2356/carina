# Gap 13 - Prompt 05: Cleanup - Remove Stale Bare-Metal Files and Supervisor Configs

**Gap:** 13 Docker Migration
**Prompt number:** 05 of 05
**Name:** Bare-Metal Cleanup - Remove Supervisor Configs, Stale Files, Old Artifacts
**Primary agent:** Claude Code
**Estimated hours:** 1-2 h
**Depends on:** Prompt 04 completed and all services verified running in Docker

**Do NOT run this prompt until Prompt 04 is complete and you have confirmed for at least
30 minutes that all Docker services are healthy and traffic is flowing correctly.**

---

## Read First

Before deleting anything, read the list of what is safe to remove and what to keep.

Safe to remove:
- Supervisor `.conf` files for migrated services (carina-cloud, carina-core, carina-hub,
  carina-ops, labyrinth-scout, scout-engine, nginx-reload)
- Bare-metal `node_modules/` directories in `/home/malike/apps/` (Docker builds its own)
- Build artifacts (`dist/`, `.next/`) in `/home/malike/apps/` that are now built inside Docker
- The old bare-metal nginx conf files for Carina/Scout domains in `/etc/nginx/conf.d/`
  (already replaced by the Docker nginx)
- The stale `carina-postgres-1` and `carina-redis-1` Docker containers from the old
  separate stack (different from `corecarinaaiuk-postgres-1` in the prod stack)

Keep - do NOT remove:
- `/etc/supervisor/conf.d/propreneur-horizon.conf`
- `/etc/supervisor/conf.d/propreneur-scheduler.conf`
- `/etc/nginx/conf.d/propreneur.uk.conf`
- `/etc/nginx/conf.d/tuinapp.co.uk.conf`
- `/etc/nginx/conf.d/tuinapp.uk.conf`
- `/etc/nginx/conf.d/propcalc.uk.conf`
- `/etc/nginx/conf.d/verlox.uk.conf`
- `/etc/nginx/conf.d/va.verlox.uk.conf`
- `/home/malike/apps/va.verlox.uk/`
- `/etc/letsencrypt/` - never touch this
- `/home/malike/apps/carinaai.uk-static/` - still needed by `carinaai.uk.conf` static root
- `/home/malike/apps/labyrinthscout.com-static/` - mounted into Docker nginx

---

## Step 1: Remove migrated supervisor conf files

```bash
ssh malike@80.190.81.208

# Confirm these are stopped and autostart=false before deleting
sudo supervisorctl status carina-cloud carina-core carina-hub carina-ops labyrinth-scout scout-engine

# Remove conf files
sudo rm /etc/supervisor/conf.d/carina-cloud.conf
sudo rm /etc/supervisor/conf.d/carina-core.conf
sudo rm /etc/supervisor/conf.d/carina-hub.conf
sudo rm /etc/supervisor/conf.d/carina-ops.conf
sudo rm /etc/supervisor/conf.d/labyrinth-scout.conf
sudo rm /etc/supervisor/conf.d/scout-engine.conf
sudo rm /etc/supervisor/conf.d/nginx-reload.conf

# Reload supervisor so it forgets about the removed programs
sudo supervisorctl reread && sudo supervisorctl update

# Confirm only propreneur remains
sudo supervisorctl status
```

Expected output: only `propreneur-horizon` and `propreneur-scheduler` listed.

---

## Step 2: Remove bare-metal nginx vhost files for migrated domains

The Docker nginx now handles these domains. The bare-metal nginx is disabled. These files
are no longer used but will cause confusion if left.

```bash
# Remove Carina and Scout vhosts (bare-metal nginx disabled, but clean up anyway)
sudo rm /etc/nginx/conf.d/app.carinaai.uk.conf
sudo rm /etc/nginx/conf.d/core.carinaai.uk.conf
sudo rm /etc/nginx/conf.d/hub.carinaai.uk.conf
sudo rm /etc/nginx/conf.d/ops.carinaai.uk.conf
sudo rm /etc/nginx/conf.d/console.labyrinthscout.com.conf
sudo rm /etc/nginx/conf.d/labyrinthscout.com.conf
sudo rm /etc/nginx/conf.d/carinaai.uk.conf

# Remove stale backup files
sudo rm -f /etc/nginx/conf.d/propcalc.uk.conf.bak-codex-20260615051600
sudo rm -f /etc/nginx/conf.d/va.verlox.uk.conf.bak.20260609193126

# Verify what remains (should be only propreneur, tuinapp, propcalc, verlox, agents, etc.)
ls /etc/nginx/conf.d/
```

Note: The bare-metal nginx is disabled. These files being present or absent has no live
effect. Removing them is purely for cleanliness.

---

## Step 3: Remove bare-metal node_modules and build artifacts

These consume significant disk space. Docker builds its own inside the container image.

```bash
# Carina core
rm -rf /home/malike/apps/core.carinaai.uk/node_modules
# Keep dist/ because the current Docker image may reference it during build
# Actually: if Docker builds from source in the image, dist/ on the host is stale
# Check the Dockerfile: if it runs `npm run build` inside, remove dist/ too
# ls /home/malike/apps/core.carinaai.uk/dist 2>/dev/null && echo "dist exists"
# Decision: remove dist/ only if Docker build confirmed working (it is, from Step 4 of 04)
rm -rf /home/malike/apps/core.carinaai.uk/dist

# app.carinaai.uk (Next.js)
rm -rf /home/malike/apps/app.carinaai.uk/node_modules
rm -rf /home/malike/apps/app.carinaai.uk/.next

# ops.carinaai.uk
rm -rf /home/malike/apps/ops.carinaai.uk/node_modules
rm -rf /home/malike/apps/ops.carinaai.uk/dist

# console.labyrinthscout.com
rm -rf /home/malike/apps/console.labyrinthscout.com/node_modules
rm -rf /home/malike/apps/console.labyrinthscout.com/dist

# scout-engine
rm -rf /home/malike/apps/scout-engine/node_modules
rm -rf /home/malike/apps/scout-engine/dist
```

After removal:
```bash
df -h /
```

Typical savings: 2-5 GB from node_modules alone.

---

## Step 4: Remove stale Docker containers from the old separate stack

Confirm these are from an old stack (not the current prod stack) before removing:

```bash
# List all containers including stopped ones
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
```

Look for containers named `carina-postgres-1` and `carina-redis-1` (without the
`corecarinaaiuk-` prefix). These are from the old standalone `docker-compose.yml` that
pre-dated the `docker-compose.prod.yml`. If they are Exited, remove them:

```bash
# Only remove if confirmed stale (Exited status, old stack)
docker rm carina-postgres-1 carina-redis-1 2>/dev/null || echo "not found or already removed"
```

Also prune unused images to free disk space:
```bash
docker image prune -f
docker volume prune -f  # Only prunes volumes NOT referenced by any container - safe
```

---

## Step 5: Remove the old start.sh files (replaced by Docker)

The bare-metal apps had `start.sh` scripts that supervisor used to launch them:

```bash
# These are now irrelevant - Docker handles startup
rm -f /home/malike/apps/app.carinaai.uk/start.sh
rm -f /home/malike/apps/core.carinaai.uk/start.sh
# Check if others exist
ls /home/malike/apps/*/start.sh 2>/dev/null
```

Keep any `start.sh` inside the `docker/` subdirectory (those are Docker entrypoints).
Only remove top-level `start.sh` files.

---

## Step 6: Commit the compose files and Dockerfiles added during this migration

The new files created across prompts 01-03 need to be committed to the repo and
deployed (so they survive a fresh git clone or server move):

Files to commit (in `core.carinaai.uk` repo):
- `docker/nginx/console.labyrinthscout.com.conf`
- `docker/nginx/labyrinthscout.com.conf`
- `docker-compose.prod.yml` (modified: SSL mount, proxy network, port changes)
- `.env.example` (updated with VPS context overrides)

Files to commit (in `console.labyrinthscout.com` repo):
- `docker-compose.prod.yml` (new)
- `Dockerfile` (new, if created in Prompt 03)
- `.env.example` (new)

Run standard commit flow for each repo. Follow commit message conventions used
in recent git log output.

---

## Step 7: Document the new deploy procedure

Update or create `core.carinaai.uk/docker/DEPLOY.md` (it may already exist - read it first):

Add a section documenting the new full-Docker procedure:

```markdown
## Full Docker deploy (current standard as of 2026-06)

### Prerequisites (one-time setup on a new server)
1. Install Docker and Docker Compose plugin
2. Install certbot and obtain certs for all domains
3. Create the shared proxy network: docker network create proxy
4. Copy .env.runtime to the server

### Deploy Carina stack
    cd /home/malike/apps/core.carinaai.uk
    git pull
    docker compose -f docker-compose.prod.yml build --no-cache
    docker compose -f docker-compose.prod.yml up -d

### Deploy Scout stack
    cd /home/malike/apps/console.labyrinthscout.com
    git pull
    docker compose -f docker-compose.prod.yml build --no-cache
    docker compose -f docker-compose.prod.yml up -d

### Moving to a new server
1. On new server: install Docker, certbot, run certbot for all domains
2. Run: docker network create proxy
3. rsync or git clone each app repo
4. Copy .env.runtime and .env files (never in git)
5. docker compose -f docker-compose.prod.yml up -d (in each stack)
6. Update DNS to point to new server IP
```

---

## Final verification

```bash
# All Carina services healthy
docker compose -f /home/malike/apps/core.carinaai.uk/docker-compose.prod.yml ps

# All Scout services healthy
docker compose -f /home/malike/apps/console.labyrinthscout.com/docker-compose.prod.yml ps

# Only propreneur in supervisor
sudo supervisorctl status

# Disk space recovered
df -h /

# No stale node_modules remaining
du -sh /home/malike/apps/*/node_modules 2>/dev/null || echo "None found - clean"
```

---

## Verification checklist

- [ ] `sudo supervisorctl status` shows only propreneur-horizon and propreneur-scheduler
- [ ] `/etc/supervisor/conf.d/` has only propreneur conf files (plus any system defaults)
- [ ] `docker ps` shows all Carina and Scout containers healthy
- [ ] `df -h` shows meaningful disk space recovered vs before cleanup
- [ ] No `node_modules/` in `/home/malike/apps/` bare-metal directories
- [ ] New compose files committed to git in both repos
- [ ] DEPLOY.md updated with new procedure
- [ ] `curl https://core.carinaai.uk/api/health` returns 200
- [ ] `curl https://console.labyrinthscout.com/` returns 200
- [ ] `curl https://app.carinaai.uk/` returns 200
