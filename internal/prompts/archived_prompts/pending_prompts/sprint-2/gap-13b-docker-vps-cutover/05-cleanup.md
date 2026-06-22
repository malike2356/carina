# Gap 13 - Prompt 05: Cleanup - Remove Stale Bare-Metal Files and Supervisor Configs

**Status: COMPLETED 2026-06-21**

**Gap:** 13 Docker Migration
**Prompt number:** 05 of 05
**Name:** Bare-Metal Cleanup - Remove Supervisor Configs, Stale Files, Old Artifacts
**Primary agent:** Claude Code
**Estimated hours:** 1-2 h
**Depends on:** Prompt 04 completed and all services verified running in Docker

**Do NOT run this prompt until Prompt 04 is complete and you have confirmed for at least
30 minutes that all Docker services are healthy and traffic is flowing correctly.**

---

## Post-build (MANDATORY)

What was built:
- Removed stale bare-metal service assumptions from the cutover path
- Left the VPS in a Docker-first operational state
- Confirmed the live deployment can restart cleanly with the new stack layout

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


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

NOTE: Already done. All nginx vhost configs, Scout Dockerfile, Scout docker-compose.prod.yml,
Carina compose changes, and .env.example updates were committed in commit `c6e5c4f` during
Prompt 01-03 implementation. No action needed here.

---

## Step 7: Document the new deploy procedure

NOTE: Already done. `docker/DEPLOY.md` was rewritten in commit `fd829d0` to document the
full-Docker architecture with Scout, the proxy network, new server setup steps, and the
updated `scripts/deploy-carina.sh` as the standard deploy command. No action needed here.

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
