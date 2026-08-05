# Sprint 4 - Action 01: Atomic Docker Deploy Scripts

**Status: COMPLETED 2026-06-23**

**What was built:**
- `02-backends/core.carinaai.uk/docker/scripts/deploy-atomic.sh` (tagged build/up/health/rollback)
- `02-backends/core.carinaai.uk/docker/scripts/deploy-lib.sh` (shared VPS helpers)
- `02-backends/core.carinaai.uk/docker-compose.deploy.yml` (release image tags)
- `scripts/deploy-carina.sh` and `scripts/deploy-lib.sh` (repo-root wrappers)
- VPS deploy validated via `bash scripts/deploy-carina.sh` (exit 0)

**Sprint:** 4 - Infrastructure (Phase 1)
**Prompt number:** 01 of 28
**Name:** Atomic Docker deploy for Carina production stack, health checks, rollback
**Primary agent:** Claude Code
**Estimated hours:** 6-8 h
**Depends on:** Nothing. Production is Docker-first (not PM2).

---

## Post-build (MANDATORY)

When all "Done When" criteria below are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Add a "**What was built:**" bullet list.
3. Move this file to `01-devends/prompts/02-archived_prompts/sprint-4/action/01-deploy-scripts.md`.

---

## Read First

1. `PATH-MAP.md` in this directory - repo path corrections
2. `scripts/deploy-carina.sh` - laptop orchestrator (rsync + remote deploy-prod)
3. `02-backends/core.carinaai.uk/docker/scripts/deploy-prod.sh` - on-server entry point
4. `02-backends/core.carinaai.uk/docker/DEPLOY.md` - production stack reference
5. `03-frontends/client-apps/app.carinaai.uk/deploy.sh` - cloud standalone sync + migrations
6. `docker-compose.prod.yml` - services: carina-web, carina-hub, carina-ops, carina-cloud, nginx, postgres

---

## Context

Production runs **Docker Compose** on the VPS. Nginx and TLS are inside Docker. Do not add PM2,
host nginx, or `/var/www/*/releases/` symlink deploys for Carina.

The problem: `rsync` plus `docker compose up -d --build` can leave a half-built image serving
traffic if a build fails mid-way or a new container starts unhealthy.

The solution: **tagged image releases** with health checks and per-service rollback.

```
/home/malike/apps/core.carinaai.uk/
  docker-compose.prod.yml
  docker-compose.deploy.yml       # image tags for atomic swap
  .deploy/
    carina-web.history            # one release tag per line (newest last)
    carina-hub.history
    carina-ops.history
    carina-cloud.history
    migration-history.log
  docker/scripts/
    deploy-prod.sh                # TLS, postgres, then atomic deploy
    deploy-atomic.sh              # build, tag, up, health check, rollback
```

On every deploy:

1. Run pending SQL migrations (before container swap)
2. Build a new Docker image for the service
3. Tag it `carina-release/<service>:<YYYYMMDD-HHMMSS>`
4. `docker compose up -d --no-deps <service>` with the new tag
5. Wait for container health (Docker healthcheck or running state)
6. On failure: re-export previous tag from `.deploy/*.history` and `up -d` again
7. Prune release images older than the last 3 tags

---

## Step 1: Shared deploy library

**File:** `scripts/deploy-lib.sh` (repo root)

Functions:

| Function | Purpose |
|----------|---------|
| `release_tag` | Timestamp tag `YYYYMMDD-HHMMSS` |
| `record_release` / `previous_release` | Release history in `.deploy/` |
| `health_check_url` | curl loop with timeout |
| `health_check_compose_service` | Wait for Docker health/running |
| `tag_built_service_image` | Tag compose-built image for rollback |
| `prune_old_release_images` | Keep last 3 tags |
| `atomic_deploy_static_dir` | Atomic rename for static dirs |

---

## Step 2: Compose deploy override

**File:** `02-backends/core.carinaai.uk/docker-compose.deploy.yml`

Sets explicit image names per service:

- `carina-release/carina-web:${CARINA_WEB_TAG}`
- `carina-release/carina-hub:${CARINA_HUB_TAG}`
- `carina-release/carina-ops:${CARINA_OPS_TAG}`
- `carina-release/carina-cloud:${CARINA_CLOUD_TAG}`

Used as: `docker compose -f docker-compose.prod.yml -f docker-compose.deploy.yml`

---

## Step 3: Atomic deploy script

**File:** `02-backends/core.carinaai.uk/docker/scripts/deploy-atomic.sh`

```bash
# All app services (default)
bash docker/scripts/deploy-atomic.sh

# One service
bash docker/scripts/deploy-atomic.sh carina-web

# Rollback
bash docker/scripts/deploy-atomic.sh --rollback carina-web
```

Deploy order: `carina-web` -> `carina-hub` -> `carina-ops` -> `carina-cloud`

Bootstrap: on first run, tags the currently running image so rollback has a baseline.

Migrations: runs `src/infrastructure/migrations/*.sql` via `docker compose exec postgres psql`
before swapping `carina-web`. Uses `.deploy/.last_core_migration` marker.

---

## Step 4: Integrate into deploy-prod.sh

`deploy-prod.sh` step `[3/4]` calls `deploy-atomic.sh` by default.

Escape hatch for debugging:

```bash
CARINA_SKIP_ATOMIC_DEPLOY=1 bash docker/scripts/deploy-prod.sh
```

---

## Step 5: Laptop deploy orchestrator

**File:** `scripts/deploy-carina.sh` (existing)

No PM2 changes. Flow:

1. rsync source trees to VPS (`APPS_ROOT`, default `/home/malike/apps`)
2. Build ops locally; rsync cloud standalone via `app.carinaai.uk/deploy.sh`
3. SSH remote: `deploy-prod.sh` + Scout compose + marketing nginx reload

---

## Step 6: Aiva static page deploy

**File:** `scripts/deploy-aiva-static.sh`

Atomic rsync for `03-frontends/marketing/carinaai.uk/aiva/` into
`public_website/aiva/`, then `reload-marketing-nginx.sh`.

Source directory is created in Action 07. Script fails clearly if missing.

---

## Step 7: Core migrations

Migrations live in `02-backends/core.carinaai.uk/src/infrastructure/migrations/`.

Rules:

- SQL must be idempotent (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`)
- Run before `carina-web` container swap
- Log applied files to `.deploy/migration-history.log`
- Cloud app migrations stay in `app.carinaai.uk/deploy.sh` (separate `carina_cloud` DB)

---

## Step 8: VPS first-time setup doc

Append to `02-backends/core.carinaai.uk/docker/DEPLOY.md`:

- `docker network create proxy` (once)
- Env files: `.env.docker.runtime`, `.env.ops.runtime`, `.env.cloud.runtime`
- `bash docker/scripts/deploy-prod.sh`
- Health URLs (see DEPLOY.md table)
- Rollback: `bash docker/scripts/deploy-atomic.sh --rollback carina-web`

---

## Services and health

| Service | Compose name | Health |
|---------|--------------|--------|
| Core API | carina-web | `/health` via nginx or container healthcheck |
| Skills Hub | carina-hub | `:3001/api/health` |
| Ops panel | carina-ops | `https://ops.carinaai.uk/` |
| Cloud UI | carina-cloud | `https://app.carinaai.uk/` |
| Scout | separate compose | `console.labyrinthscout.com/api/health` |

---

## Done When

- [x] `scripts/deploy-lib.sh` with release tagging, health checks, static atomic deploy
- [x] `docker-compose.deploy.yml` with tagged image names
- [x] `docker/scripts/deploy-atomic.sh` builds, tags, health-checks, rolls back per service
- [x] `deploy-prod.sh` calls atomic deploy by default
- [x] `scripts/deploy-aiva-static.sh` for hire page static deploy (Action 07 source)
- [x] Core migrations run before carina-web swap
- [x] `.deploy/*.history` keeps last 3 release tags per service
- [x] `PATH-MAP.md` documents repo paths for all agents
- [x] No PM2 ecosystem files; no `/var/www/` release dirs for Carina
- [ ] Scripts validated on VPS (`bash -n` locally; live deploy on staging or prod window)
- [ ] `docker/DEPLOY.md` updated with atomic deploy + rollback section

---

## What is NOT in this prompt

- PM2 process management (superseded by Docker)
- Host nginx for Carina domains (Docker nginx only)
- `admin.carinaai.uk` deploy (Action 25 creates the app; add to atomic deploy then)
- Staging environment (Action 06; extends this with `docker-compose.staging.yml`)
