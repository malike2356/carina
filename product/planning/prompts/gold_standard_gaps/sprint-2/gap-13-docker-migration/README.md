# Gap 13 - Full Docker Migration (Carina + Labyrinth Scout)

**Gap:** 13 Infrastructure Standardisation
**Sprint:** 2
**Goal:** Move every application service off bare metal supervisor into Docker Compose.
Containerize Nginx. Remove all supervisor-managed Node processes. Leave zero bare-metal
app state that would need to be recreated on a server move.

**Primary agent:** Claude Code (or Codex / Cursor if Claude hits usage limits mid-task)
**Estimated total hours:** 6-10 h across 5 prompts
**Risk level:** Medium. Services that are already down (carina-cloud, carina-hub) have no
migration risk. The live services (labyrinth-scout, carina-ops, carina-web) need a brief
controlled cutover.

---

## VPS access

Host: `80.190.81.208`
SSH user: `malike`
Apps root: `/home/malike/apps/`
Nginx conf: `/etc/nginx/conf.d/`
Supervisor conf: `/etc/supervisor/conf.d/`

---

## Current state (as of 2026-06-21)

### Supervisor-managed processes

| Program | Status | Port | Notes |
|---------|--------|------|-------|
| carina-cloud | STOPPED | 4100 | Next.js frontend for app.carinaai.uk |
| carina-core | RUNNING | 3333/3334 | DUPLICATE of Docker carina-web |
| carina-hub | STOPPED | 3001 | DUPLICATE of Docker carina-hub |
| carina-ops | RUNNING | 4001 | ops.carinaai.uk admin API |
| labyrinth-scout | RUNNING | 4444 | console.labyrinthscout.com |
| scout-engine | RUNNING | 4455 | internal event ingestion |
| nginx-reload | FATAL | n/a | stale reload helper, not needed |
| propreneur-horizon | RUNNING | n/a | OUT OF SCOPE - do not touch |
| propreneur-scheduler | RUNNING | n/a | OUT OF SCOPE - do not touch |

### Running Docker containers

From `core.carinaai.uk/docker-compose.prod.yml` (partially active):
- `corecarinaaiuk-carina-web-1` - HEALTHY, port 3300 (the real core API)
- `corecarinaaiuk-carina-hub-1` - RESTARTING (startup crash, needs fix)
- `corecarinaaiuk-redis-1` - healthy
- `corecarinaaiuk-postgres-1` - healthy

From other stacks:
- `carina-postgres-1`, `carina-redis-1` - from an older/separate stack (stale)
- `tuinapp_*` - separate project, OUT OF SCOPE
- `propreneur-observability-*` - OUT OF SCOPE
- `portainer` - keep

### Bare-metal nginx

Serves ALL traffic via `/etc/nginx/conf.d/*.conf` (not the sites-enabled default).
Current proxy targets (all 127.0.0.1:PORT):
- `app.carinaai.uk` -> 4100 (carina-cloud, STOPPED - site is DOWN)
- `core.carinaai.uk` -> 3300 (carina-web Docker - working)
- `hub.carinaai.uk` -> 3001 (carina-hub Docker, RESTARTING - site is DOWN)
- `ops.carinaai.uk` -> 4001 (carina-ops supervisor - working)
- `console.labyrinthscout.com` -> 4444 (labyrinth-scout supervisor - working)

### SSL certs on host

`/etc/letsencrypt/live/carinaai.uk/` - covers app, core, hub, ops subdomains
`/etc/letsencrypt/live/labyrinthscout.com/` - covers console subdomain

---

## Target state

One Docker Compose stack per project family, plus a shared nginx container.

```
bare-metal nginx: REMOVED
bare-metal supervisor (app services): REMOVED (propreneur stays)

nginx container (in carina stack)
  port 80:80
  port 443:443
  mounts /etc/letsencrypt from host (read-only)
  on network: proxy (external, shared)

Carina stack (core.carinaai.uk/docker-compose.prod.yml)
  carina-web        -> proxy_pass http://carina-web:3000
  carina-hub        -> proxy_pass http://carina-hub:3001
  carina-ops        -> proxy_pass http://carina-ops:4001
  carina-cloud      -> proxy_pass http://carina-cloud:4100
  postgres (carina private)
  redis (carina private)
  network: carina (internal) + proxy (shared with nginx)

Scout stack (console.labyrinthscout.com/docker-compose.prod.yml)
  labyrinth-scout   -> proxy_pass http://labyrinth-scout:3001
  scout-engine      (internal only, no nginx exposure)
  postgres (scout private)
  redis (scout private)
  network: scout (internal) + proxy (shared with nginx)
```

### Port publishing after migration

Only nginx publishes ports to the host:
- nginx: 80:80, 443:443

All other containers communicate via Docker networks only. No host port bindings
on carina-web, carina-hub, carina-cloud, carina-ops, labyrinth-scout, scout-engine.

---

## What is already built (DO NOT recreate)

Before starting, read these existing files on the VPS and in the repo:

- `internal/servers/core.carinaai.uk/docker-compose.prod.yml` - full Carina stack already defined
- `internal/servers/core.carinaai.uk/docker/nginx/carina-prod.conf` - Carina vhosts already use
  Docker service names. `app.carinaai.uk` routes to `carina-web:3000` (hosted mode, not carina-cloud).
- `internal/servers/core.carinaai.uk/docker/nginx/hub.carinaai.uk.conf` - hub vhost already exists
- `internal/servers/core.carinaai.uk/docker/nginx/conf.d/ssl-params.conf` and `certbot.conf` - TLS
  snippets included by the main config
- `internal/servers/core.carinaai.uk/docker/scripts/deploy-prod.sh` - one-command deploy script
  already handles: env sync, stopping bare-metal Carina supervisor, TLS bootstrap, `docker compose up`
- `internal/servers/core.carinaai.uk/docker/scripts/stop-bare-metal-carina.sh` - stops
  carina-cloud, carina-core, carina-hub, carina-ops supervisor programs

The SSL path in the Docker nginx is `/etc/nginx/ssl/live/carinaai.uk/` (NOT `/etc/letsencrypt`).
The `deploy-prod.sh` populates `/etc/carina/ssl` on the host and the compose mounts it there.

**The Carina stack is ~80% ready. The outstanding work is:**
1. Scout domains missing from Docker nginx (console.labyrinthscout.com, labyrinthscout.com)
2. Scout stack has no production compose file
3. carina-hub is crash-looping (database issue, needs diagnosing)
4. The full cutover (switching bare-metal nginx off) has not been executed
5. Bare-metal cleanup has not been done

## Prompt execution order

Run prompts sequentially. Each prompt depends on the previous.

1. `01-nginx-container.md` - Add Scout vhost configs to Docker nginx (Carina vhosts exist already)
2. `02-carina-stack.md` - Fix hub crash, verify carina-cloud/ops build contexts, add proxy network
3. `03-scout-stack.md` - Create prod compose for Scout (console + engine)
4. `04-cutover.md` - Run deploy-prod.sh for Carina, bring up Scout, switch bare-metal nginx off
5. `05-cleanup.md` - Remove supervisor configs, stale files, old bare-metal artifacts

**Do NOT run prompt 04 (cutover) until prompts 01-03 are complete and verified.**

---

## What NOT to touch

- `propreneur-horizon` and `propreneur-scheduler` supervisor processes
- `propreneur.uk.conf` nginx vhost
- `tuinapp.*` Docker stack
- `propreneur-observability-*` Docker stack
- `portainer` container
- `/etc/letsencrypt/` directory (read from it, never write or delete)
- `/home/malike/apps/va.verlox.uk/` directory
