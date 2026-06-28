# SOP 002: Deployment Guide
**Classification:** Internal VERLOX only. Do not share externally.
**Source:** Migrated from planning/docs/DEPLOYMENT-GUIDE.md
**Last reviewed:** 2026-06-25

---

# Carina Platform Deployment Guide

This guide walks you through deploying the full Carina and Labyrinth Scout stack on any Linux server using Docker only. No bare-metal Node, no supervisor, no manual nginx on the host. If you can copy commands into a terminal and edit a few config files, you can deploy.

**Time:** first deploy on a clean VPS takes about 45 to 90 minutes (mostly Docker builds and DNS propagation).

**Canonical deploy script:** `scripts/deploy-carina.sh` from the carina repo root.

**Ops auth, user management, and ops/Scout-only deploy:** `docs/OPS-USER-MANAGEMENT.md`

**Short reference:** `internal/servers/core.carinaai.uk/docker/DEPLOY.md`

VPS details: 80.190.81.208, SSH alias: `aman`, user: `malike`, apps dir: `~/apps/`

---

## Table of contents

1. [What you are deploying](#1-what-you-are-deploying)
2. [Before you start](#2-before-you-start)
3. [Server setup](#3-server-setup)
4. [DNS records](#4-dns-records)
5. [Copy code to the server](#5-copy-code-to-the-server)
6. [Create secret files](#6-create-secret-files)
7. [First deploy](#7-first-deploy)
8. [Verify everything works](#8-verify-everything-works)
9. [Update after code changes](#9-update-after-code-changes)
10. [Move to a new server](#10-move-to-a-new-server)
11. [Backups](#11-backups)
12. [Troubleshooting](#12-troubleshooting)
13. [Appendix: domains and ports](#13-appendix-domains-and-ports)
14. [Appendix: environment variables](#14-appendix-environment-variables)

---

## 1. What you are deploying

Everything runs in Docker Compose. One nginx container on the host ports **80** and **443** routes traffic to the correct service.

```mermaid
flowchart TB
  subgraph internet [Internet]
    User[Browser / API client]
  end

  subgraph host [Linux server]
    Nginx[nginx container :80 :443]
    subgraph carina_stack [Carina compose stack]
      Cloud[carina-cloud :4100]
      Admin[carina-admin :4200]
      Core[carina-web :3000]
      Hub[carina-hub :3001]
      Ops[carina-ops :4001]
      PG[(postgres)]
      Redis[(redis)]
    end
    subgraph scout_stack [Scout compose stack]
      Console[labyrinth-scout :4444]
      Engine[scout-engine :4455]
      SPG[(scout postgres)]
      SRedis[(scout redis)]
    end
    ProxyNet[proxy Docker network]
  end

  User --> Nginx
  Nginx --> Cloud
  Nginx --> Admin
  Nginx --> Core
  Nginx --> Hub
  Nginx --> Ops
  Nginx --> Console
  Core --> PG
  Core --> Redis
  Cloud --> PG
  Admin --> PG
  Ops --> PG
  Hub --> PG
  Console --> SPG
  Console --> SRedis
  Engine --> Console
  Nginx --- ProxyNet
  Console --- ProxyNet
```

| Public URL | Container | Purpose |
|------------|-----------|---------|
| `app.carinaai.uk` | carina-cloud | Aiva customer workspace (Next.js 15) |
| `admin.carinaai.uk` | carina-admin | VERLOX internal Aiva business ops (Next.js 15) |
| `core.carinaai.uk` | carina-web | Carina backend API (Node.js/TypeScript) |
| `hub.carinaai.uk` | carina-hub | Skills Hub |
| `ops.carinaai.uk` | carina-ops | VERLOX internal engineering panel (Express/EJS) |
| `carinaai.uk` / `www` | static files | Marketing site |
| `docs.carinaai.uk` | static files | Documentation site |
| `console.labyrinthscout.com` | labyrinth-scout | Scout console (separate product, optional) |

Default production domain family is **carinaai.uk**. Change `CARINA_DOMAIN` in env files when using your own domain.

---

## 2. Before you start

### Checklist

- [ ] A Linux VPS or dedicated server (Ubuntu 22.04 or 24.04 recommended; 4 GB RAM minimum, 8 GB preferred)
- [ ] Root or sudo access
- [ ] A domain name you control
- [ ] DNS access (Cloudflare, registrar, etc.)
- [ ] SSH key login configured (password login disabled is recommended)
- [ ] Ports **80** and **443** open in the firewall and **not used by another web server** (aaPanel, Apache, host nginx must be stopped or reconfigured)
- [ ] API keys ready: at least one LLM provider (DeepSeek, Anthropic, or OpenAI), Resend for email, Stripe if billing is enabled
- [ ] This repository cloned on your laptop or the server

Note: Stripe credentials (`STRIPE_SECRET_KEY` etc.) are not yet set on the VPS. Billing flows are wired but inactive until credentials are configured.

### Paths used in this guide

Set these once in your shell (adjust names to match your server):

```bash
export DEPLOY_USER="malike"          # your SSH username
export SERVER_IP="80.190.81.208"     # Contabo VPS IP
export APPS_ROOT="/home/${DEPLOY_USER}/apps"
export SECRETS_ROOT="/home/${DEPLOY_USER}/secrets"
export CARINA_DOMAIN="carinaai.uk"   # your primary domain
export CERTBOT_EMAIL="you@example.com"
```

### Repo layout (on your laptop)

```text
carina/                                    # repo root
  scripts/deploy-carina.sh                 # one-command deploy to VPS
  scripts/deploy-marketing.sh              # marketing site deploy only
  internal/servers/core.carinaai.uk/       # Carina core + docker-compose.prod.yml
  internal/admin/ops.carinaai.uk/          # Ops panel (Express/EJS)
  external/client-apps/app.carinaai.uk/    # Aiva workspace UI (Next.js 15)
  external/client-apps/admin.carinaai.uk/  # Aiva admin UI (Next.js 15)
  internal/servers/console.labyrinthscout.com/
  internal/servers/scout-engine/
```

---

## 3. Server setup

SSH into the server as your deploy user:

```bash
ssh ${DEPLOY_USER}@${SERVER_IP}
# or using the SSH alias:
ssh aman
```

### Step 3.1: Install Docker

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker ${DEPLOY_USER}
```

Log out and back in so the `docker` group applies:

```bash
exit
ssh ${DEPLOY_USER}@${SERVER_IP}
docker run --rm hello-world
```

You should see "Hello from Docker!".

### Step 3.2: Create the shared Docker network

This network lets the Carina nginx container reach the Scout console without publishing Scout ports on the host.

```bash
docker network create proxy
```

Safe to run again; it fails silently if the network already exists.

### Step 3.3: Create directories

```bash
mkdir -p ${APPS_ROOT}/{core.carinaai.uk,ops.carinaai.uk,app.carinaai.uk,admin.carinaai.uk,console.labyrinthscout.com,scout-engine}
mkdir -p ${SECRETS_ROOT}
sudo mkdir -p /etc/carina/ssl
sudo chown -R ${DEPLOY_USER}:${DEPLOY_USER} /etc/carina/ssl
```

### Step 3.4: Free ports 80 and 443

Docker nginx needs these ports. If aaPanel, Apache, or host nginx is running:

```bash
sudo systemctl stop nginx apache2 2>/dev/null || true
sudo systemctl disable nginx apache2 2>/dev/null || true
```

Check nothing is listening:

```bash
sudo ss -tlnp | grep -E ':80|:443' || echo "Ports 80 and 443 are free"
```

### Step 3.5: Install helper tools

```bash
sudo apt-get install -y git rsync python3 openssl
```

---

## 4. DNS records

Point these hostnames at `${SERVER_IP}`. Use A records (or CNAME to a single A record).

| Hostname | Type | Value |
|----------|------|-------|
| `carinaai.uk` | A | `${SERVER_IP}` |
| `www.carinaai.uk` | A or CNAME | `${SERVER_IP}` or `carinaai.uk` |
| `app.carinaai.uk` | A | `${SERVER_IP}` |
| `admin.carinaai.uk` | A | `${SERVER_IP}` |
| `core.carinaai.uk` | A | `${SERVER_IP}` |
| `hub.carinaai.uk` | A | `${SERVER_IP}` |
| `ops.carinaai.uk` | A | `${SERVER_IP}` |
| `docs.carinaai.uk` | A | `${SERVER_IP}` |
| `install.carinaai.uk` | A | `${SERVER_IP}` |
| `skills.carinaai.uk` | A | `${SERVER_IP}` |
| `console.labyrinthscout.com` | A | `${SERVER_IP}` |
| `labyrinthscout.com` | A | `${SERVER_IP}` |

Replace `carinaai.uk` with your domain everywhere if not using the default.

Wait for DNS to propagate before requesting TLS certificates (check with `dig +short app.carinaai.uk`).

---

## 5. Copy code to the server

### Option A: Deploy from your laptop (recommended)

On your laptop, from the carina repo root:

```bash
export VPS_HOST="${SERVER_IP}"
export VPS_USER="${DEPLOY_USER}"
bash scripts/deploy-carina.sh
```

This rsyncs all app directories and runs Docker Compose on the server. Skip to [section 6](#6-create-secret-files) first if env files do not exist yet (first deploy will warn about missing secrets).

### Option B: Clone on the server

```bash
cd ${APPS_ROOT}
git clone YOUR_GIT_URL carina-repo
cp -a carina-repo/internal/servers/core.carinaai.uk/. ${APPS_ROOT}/core.carinaai.uk/
cp -a carina-repo/internal/admin/ops.carinaai.uk/. ${APPS_ROOT}/ops.carinaai.uk/
cp -a carina-repo/external/client-apps/app.carinaai.uk/. ${APPS_ROOT}/app.carinaai.uk/
cp -a carina-repo/external/client-apps/admin.carinaai.uk/. ${APPS_ROOT}/admin.carinaai.uk/
cp -a carina-repo/internal/servers/console.labyrinthscout.com/. ${APPS_ROOT}/console.labyrinthscout.com/
cp -a carina-repo/internal/servers/scout-engine/. ${APPS_ROOT}/scout-engine/
```

---

## 6. Create secret files

**Never commit these files to git.** Permissions should be `600` where possible.

### 6.1 Carina core secrets

On the server:

```bash
cd ${APPS_ROOT}/core.carinaai.uk
cp .env.production.example .env.docker.runtime
chmod 600 .env.docker.runtime
nano .env.docker.runtime   # or vim
```

Fill in at minimum:

| Variable | How to get it |
|----------|---------------|
| `CARINA_DOMAIN` | Your domain, e.g. `carinaai.uk` |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `DEEPSEEK_API_KEY` or `ANTHROPIC_API_KEY` | From provider dashboard |
| `RESEND_API_KEY` | From resend.com |
| `DB_PASSWORD` | Strong password; also used by Docker postgres |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | From Stripe dashboard (required for billing; currently blank on VPS) |
| `SKILLS_HUB_PUBLISH_KEY` | `openssl rand -hex 16` |
| `TENANT_KEY_ENCRYPTION_KEY` | `openssl rand -hex 32` |

Stripe webhook endpoint: `POST https://core.carinaai.uk/webhooks/stripe`

The sync script rewrites database URLs for Docker networking:

```bash
python3 docker/scripts/sync-docker-env.py
```

This sets `DATABASE_URL=postgresql://carina:YOUR_PASSWORD@postgres:5432/carina` and similar for Redis.

### 6.2 Ops panel secrets

```bash
cd ${APPS_ROOT}/ops.carinaai.uk
cp .env.example .env
chmod 600 .env
nano .env
```

| Variable | Notes |
|----------|-------|
| `ADMIN_PASSWORD` | Login password for ops.carinaai.uk |
| `SESSION_SECRET` | `openssl rand -hex 32` |
| `CARINA_OPS_TOKEN` | Must match `CARINA_OPS_TOKEN` in core `.env.docker.runtime` |
| `SCOUT_API_KEY` | Must match Scout `.env` |

Copy into compose runtime file:

```bash
cd ${APPS_ROOT}/core.carinaai.uk
cp ${APPS_ROOT}/ops.carinaai.uk/.env .env.ops.runtime
python3 docker/scripts/sync-ops-env.py
```

### 6.3 Aiva workspace app secrets

```bash
cd ${APPS_ROOT}/app.carinaai.uk
cp .env.example .env
chmod 600 .env
nano .env
```

| Variable | Notes |
|----------|-------|
| `VAULT_SECRET` | `openssl rand -hex 32` |
| `BETTER_AUTH_SECRET` | `openssl rand -hex 32` |
| `BETTER_AUTH_URL` | `https://app.${CARINA_DOMAIN}` |
| `NEXT_PUBLIC_APP_URL` | Same as above |
| `CARINA_OPS_TOKEN` | Same token as core and ops |
| `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe keys (currently blank on VPS) |

Copy into compose runtime:

```bash
cd ${APPS_ROOT}/core.carinaai.uk
cp ${APPS_ROOT}/app.carinaai.uk/.env .env.cloud.runtime
python3 docker/scripts/sync-cloud-env.py
```

### 6.4 Scout secrets

```bash
cd ${APPS_ROOT}/console.labyrinthscout.com
cp .env.example .env
chmod 600 .env
nano .env
```

| Variable | Notes |
|----------|-------|
| `SCOUT_DB_PASSWORD` | Password for Scout postgres container |
| `SCOUT_API_KEY` | `openssl rand -hex 32` |
| `SCOUT_SESSION_SECRET` | `openssl rand -hex 32` |
| `SCOUT_CONSOLE_PUBLIC_URL` | `https://console.labyrinthscout.com` |

### 6.5 Match tokens across services

These values **must be identical** wherever listed:

| Token | Files |
|-------|-------|
| `CARINA_OPS_TOKEN` | core `.env.docker.runtime`, ops `.env`, cloud `.env` |
| `SCOUT_API_KEY` | Scout `.env`, ops `.env` |
| `DB_PASSWORD` | core compose env / `.env.docker.runtime` (postgres user `carina`) |

Generate once:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 7. First deploy

All commands below run **on the server** unless noted.

### Step 7.1: Set build contexts

```bash
cd ${APPS_ROOT}/core.carinaai.uk

export CARINA_OPS_CONTEXT=${APPS_ROOT}/ops.carinaai.uk
export CARINA_CLOUD_CONTEXT=${APPS_ROOT}/app.carinaai.uk
export CARINA_OPS_DOCKERFILE=docker/Dockerfile
export CARINA_CLOUD_DOCKERFILE=docker/Dockerfile
export CARINA_SSL_DIR=/etc/carina/ssl
export CERTBOT_EMAIL="${CERTBOT_EMAIL}"
export DB_PASSWORD="your-db-password-from-env"
```

Using `docker/Dockerfile` (not `Dockerfile.runtime`) builds inside Docker so you do not need Node installed on the host.

### Step 7.2: Sync env files for Docker networking

```bash
python3 docker/scripts/sync-docker-env.py
python3 docker/scripts/sync-ops-env.py
python3 docker/scripts/sync-cloud-env.py
```

### Step 7.3: Stop any legacy bare-metal processes

If you previously ran Carina with supervisor:

```bash
bash docker/scripts/stop-bare-metal-carina.sh
sudo supervisorctl stop carina-core carina-hub carina-ops carina-cloud 2>/dev/null || true
```

### Step 7.4: Start the Carina stack

```bash
bash docker/scripts/deploy-prod.sh
```

What this script does:

1. Starts postgres and redis
2. If no TLS cert exists, bootstraps HTTP and runs certbot for all Carina subdomains
3. Builds and starts carina-web, carina-hub, carina-ops, carina-cloud, carina-admin, nginx, certbot
4. Waits for carina-web health check

First build can take 20 to 40 minutes on a small VPS.

### Step 7.5: Start the Scout stack

Scout is a separate product at console.labyrinthscout.com. Skip this step if not deploying Scout.

```bash
cd ${APPS_ROOT}/console.labyrinthscout.com
export SCOUT_ENGINE_CONTEXT=${APPS_ROOT}/scout-engine
docker compose -f docker-compose.prod.yml up -d --build
```

### Step 7.6: Reload nginx (if you changed configs)

```bash
cd ${APPS_ROOT}/core.carinaai.uk
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

---

## 8. Verify everything works

Run these from your laptop or the server:

```bash
curl -fsS https://core.${CARINA_DOMAIN}/health
curl -fsS https://hub.${CARINA_DOMAIN}/api/health
curl -fsS -o /dev/null -w "%{http_code}\n" https://app.${CARINA_DOMAIN}/
curl -fsS https://ops.${CARINA_DOMAIN}/health
curl -fsS https://console.labyrinthscout.com/api/health
```

Expected: JSON with `"ok":true` or HTTP `200` for the app homepage.

On the server:

```bash
cd ${APPS_ROOT}/core.carinaai.uk
docker compose -f docker-compose.prod.yml ps
```

All services should show `Up` and `(healthy)` where health checks exist.

Check logs if something failed:

```bash
docker compose -f docker-compose.prod.yml logs -f carina-web
docker compose -f docker-compose.prod.yml logs -f carina-cloud
docker compose -f docker-compose.prod.yml logs -f nginx
```

---

## 9. Update after code changes

### From your laptop (easiest)

```bash
cd /path/to/carina
export VPS_HOST="${SERVER_IP}"
export VPS_USER="${DEPLOY_USER}"
bash scripts/deploy-carina.sh
```

### Marketing site only

```bash
bash scripts/deploy-marketing.sh carina
```

### On the server only

```bash
cd ${APPS_ROOT}/core.carinaai.uk
git pull   # if you cloned on server
export CARINA_OPS_CONTEXT=${APPS_ROOT}/ops.carinaai.uk
export CARINA_CLOUD_CONTEXT=${APPS_ROOT}/app.carinaai.uk
export CARINA_OPS_DOCKERFILE=docker/Dockerfile
export CARINA_CLOUD_DOCKERFILE=docker/Dockerfile
python3 docker/scripts/sync-docker-env.py
python3 docker/scripts/sync-ops-env.py
python3 docker/scripts/sync-cloud-env.py
docker compose -f docker-compose.prod.yml up -d --build
```

Scout (if deployed):

```bash
cd ${APPS_ROOT}/console.labyrinthscout.com
export SCOUT_ENGINE_CONTEXT=${APPS_ROOT}/scout-engine
docker compose -f docker-compose.prod.yml up -d --build
```

**Important:** Scout's `Dockerfile` copies paths like `console.labyrinthscout.com/src` relative to the **apps root** (`${APPS_ROOT}`), not the console directory alone. If `docker compose build` fails with "console.labyrinthscout.com/src not found", build from the parent:

```bash
cd ${APPS_ROOT}
docker build -f console.labyrinthscout.com/Dockerfile -t consolelabyrinthscoutcom-labyrinth-scout:latest .
cd console.labyrinthscout.com
set -a && source .env && set +a
docker compose -f docker-compose.prod.yml up -d --no-build labyrinth-scout
```

### Deploy only ops panel

```bash
cd ${APPS_ROOT}/ops.carinaai.uk && pnpm install && pnpm build
cd ${APPS_ROOT}/core.carinaai.uk
export CARINA_OPS_CONTEXT=${APPS_ROOT}/ops.carinaai.uk
export CARINA_OPS_DOCKERFILE=docker/Dockerfile.runtime
cp ${APPS_ROOT}/ops.carinaai.uk/.env .env.ops.runtime
python3 docker/scripts/sync-ops-env.py
docker compose -f docker-compose.prod.yml up -d --build --no-deps carina-ops
```

### Deploy only Aiva workspace UI

If you changed only the Next.js app (app.carinaai.uk):

```bash
cd external/client-apps/app.carinaai.uk
pnpm install
pnpm build
cd ${APPS_ROOT}/core.carinaai.uk
docker compose -f docker-compose.prod.yml up -d --build carina-cloud
```

---

## 10. Move to a new server

Use this when changing hosts or cloud providers.

### Step 10.1: Back up on the old server

See [section 11](#11-backups).

### Step 10.2: Prepare the new server

Repeat [sections 3](#3-server-setup) and [4](#4-dns-records). Update DNS to the new IP **before** running certbot, or copy existing certs.

### Step 10.3: Copy files

```bash
# From old server to new (run on laptop)
rsync -az ${DEPLOY_USER}@OLD_IP:${APPS_ROOT}/ ${DEPLOY_USER}@NEW_IP:${APPS_ROOT}/
rsync -az ${DEPLOY_USER}@OLD_IP:${SECRETS_ROOT}/ ${DEPLOY_USER}@NEW_IP:${SECRETS_ROOT}/
rsync -az ${DEPLOY_USER}@OLD_IP:/etc/carina/ssl/ ${DEPLOY_USER}@NEW_IP:/etc/carina/ssl/
```

### Step 10.4: Restore Docker volumes

On the old server, export:

```bash
docker run --rm -v corecarinaaiuk_pgdata:/data -v $(pwd):/backup alpine \
  tar czf /backup/carina-pgdata.tgz -C /data .
docker run --rm -v corecarinaaiuk_redisdata:/data -v $(pwd):/backup alpine \
  tar czf /backup/carina-redis.tgz -C /data .
```

On the new server, start postgres once, then import (see [backups](#11-backups)).

### Step 10.5: Deploy on new server

```bash
docker network create proxy
cd ${APPS_ROOT}/core.carinaai.uk
bash docker/scripts/deploy-prod.sh
cd ${APPS_ROOT}/console.labyrinthscout.com
docker compose -f docker-compose.prod.yml up -d --build
```

No bare-metal setup is required on the new machine.

---

## 11. Backups

### Database (Carina postgres)

```bash
docker compose -f ${APPS_ROOT}/core.carinaai.uk/docker-compose.prod.yml \
  exec -T postgres pg_dumpall -U carina > carina-db-$(date +%F).sql
```

Restore:

```bash
cat carina-db-YYYY-MM-DD.sql | docker compose -f docker-compose.prod.yml exec -T postgres psql -U carina
```

### Named volumes

| Volume | Contents |
|--------|----------|
| `corecarinaaiuk_pgdata` | Carina postgres data |
| `corecarinaaiuk_redisdata` | Redis cache |
| `corecarinaaiuk_carina-app-data` | Carina agent data directory |
| Scout stack `pgdata` | Scout postgres |

List volumes:

```bash
docker volume ls | grep -E 'carina|scout|corecarina'
```

### TLS certificates

Stored at `/etc/carina/ssl/` (mounted into nginx). Back up this directory before rebuilding the server.

Certbot renews automatically inside the `certbot` container every 12 hours.

---

## 12. Troubleshooting

### "address already in use" on port 80, 443, 4001, or 4100

Something outside Docker is using the port.

```bash
sudo ss -tlnp | grep -E ':80|:443|:4001|:4100'
```

Stop the conflicting process (old supervisor Node, host nginx, aaPanel). For bare-metal ops:

```bash
pkill -f "ops.carinaai.uk/dist/server.js" || true
bash docker/scripts/stop-bare-metal-carina.sh
```

### carina-web unhealthy

```bash
docker compose -f docker-compose.prod.yml logs carina-web
docker compose -f docker-compose.prod.yml exec carina-web supervisorctl -c /app/docker/supervisor/supervisord.conf status
```

Common causes: wrong `DATABASE_URL`, postgres not ready, missing API keys.

### Database authentication failed

Re-run sync scripts after fixing `DB_PASSWORD` in `.env.docker.runtime`:

```bash
export DB_PASSWORD=your-password
python3 docker/scripts/sync-docker-env.py
docker compose -f docker-compose.prod.yml up -d --force-recreate carina-web carina-hub carina-ops carina-cloud
```

### Certbot / HTTPS fails

- Confirm DNS points to this server: `dig +short app.carinaai.uk`
- Confirm port 80 is reachable from the internet
- Run manually: `bash docker/scripts/init-certs.sh`
- Check cert path: `ls /etc/carina/ssl/live/carinaai.uk/`

### app.carinaai.uk shows hosted-login instead of Next.js UI

nginx is routing to core instead of cloud. Cloud UI must hit `carina-cloud:4100`. Rebuild nginx config from `docker/nginx/carina-prod.conf` and reload.

### "Core proxy is not configured" in Cloud app

Set `CARINA_USE_CORE_PROXY=true` and the same `CARINA_OPS_TOKEN` in core, ops, and cloud env files.

### Scout console unreachable

```bash
docker network inspect proxy
docker compose -f ${APPS_ROOT}/console.labyrinthscout.com/docker-compose.prod.yml ps
```

Scout must be on the `proxy` network. Carina nginx config must include `console.labyrinthscout.com.conf`.

### Docker build fails on ops or cloud

Use full Dockerfiles (build inside Docker):

```bash
export CARINA_OPS_DOCKERFILE=docker/Dockerfile
export CARINA_CLOUD_DOCKERFILE=docker/Dockerfile
```

Or pre-build on the host and use runtime images:

```bash
cd ${APPS_ROOT}/ops.carinaai.uk && pnpm install && pnpm build
export CARINA_OPS_DOCKERFILE=docker/Dockerfile.runtime
```

### `.env.runtime` is a directory

An old bind mount created a folder. Remove it (requires root) and use `.env.docker.runtime` instead:

```bash
sudo rm -rf ${APPS_ROOT}/core.carinaai.uk/.env.runtime
cp ~/.carina/.env ${APPS_ROOT}/core.carinaai.uk/.env.docker.runtime
```

---

## 13. Appendix: domains and ports

### Docker internal ports (not published to host)

| Container | Port | Production URL |
|-----------|------|----------------|
| carina-web | 3000 | core.carinaai.uk |
| carina-hub | 3001 | hub.carinaai.uk |
| carina-ops | 4001 | ops.carinaai.uk |
| carina-cloud | 4100 | app.carinaai.uk |
| carina-admin | 4200 | admin.carinaai.uk |
| labyrinth-scout | 4444 | console.labyrinthscout.com |
| scout-engine | 4455 | internal only |

Only **nginx** publishes **80** and **443** on the host.

### Carina postgres databases (created by init.sql)

| Database | Used by |
|----------|---------|
| `carina` | Core agent |
| `carina_skills_hub` | Skills Hub |
| `carina_central` | Ops panel / Aiva admin |
| `carina_cloud` | Aiva workspace app |

### DB migrations

Migrations run inline via `src/memory/migrations.ts` through `runMigrations()` at startup. The SQL files in `src/infrastructure/migrations/` are documentation only and are not run directly.

### Optional: deploy Carina without Scout

Skip section 7.5. Scout nginx snippets will 502 until Scout is deployed; remove or comment `console.labyrinthscout.com.conf` from compose if not needed. Setting `LABYRINTH_ENABLED=false` on Carina means zero Scout integration; Carina runs identically without it.

### Optional: marketing static site path

Compose mounts `${LABYRINTHSCOUT_STATIC:-/home/malike/apps/labyrinthscout.com-static}` for labyrinthscout.com. Clone or rsync the static site there, or set `LABYRINTHSCOUT_STATIC` before `docker compose up`.

---

## 14. Appendix: environment variables

### Core compose (.env.docker.runtime)

See `internal/servers/core.carinaai.uk/.env.production.example` for the full list.

Docker-specific overrides applied by `sync-docker-env.py`:

- `DATABASE_URL` -> host `postgres`
- `SKILLS_HUB_DATABASE_URL` -> host `postgres`
- `REDIS_URL` -> host `redis`

### Ops (.env.ops.runtime)

See `internal/admin/ops.carinaai.uk/.env.example`.

Docker overrides: `CARINA_API_URL=http://carina-web:3000`, `PORT=4001`.

| Variable | Notes |
|----------|--------|
| `SCOUT_CONSOLE_URL` | Docker: `http://scout-console:4444` |
| `SCOUT_ADMIN_API_URL` | Docker: `http://scout-engine:4455` |
| `SCOUT_API_KEY` | Must match Scout console |
| `SCOUT_ACCOUNT_PUBLIC_URL` | Scout password setup links; default `https://console.labyrinthscout.com` |

### Cloud / Aiva workspace (.env.cloud.runtime)

See `external/client-apps/app.carinaai.uk/.env.example`.

Docker overrides: `CARINA_CORE_URL=http://carina-web:3000`, `DATABASE_URL` -> `carina_cloud` on postgres.

### Scout (.env)

See `internal/servers/console.labyrinthscout.com/.env.example`.

Required for compose: `SCOUT_DB_PASSWORD`, `SCOUT_API_KEY`, `SCOUT_SESSION_SECRET`.

---

## Quick reference card

```bash
# One deploy from laptop
export VPS_HOST=80.190.81.208 VPS_USER=malike
bash scripts/deploy-carina.sh

# Marketing only
bash scripts/deploy-marketing.sh carina

# Status on server
docker compose -f ~/apps/core.carinaai.uk/docker-compose.prod.yml ps

# Logs
docker compose -f ~/apps/core.carinaai.uk/docker-compose.prod.yml logs -f carina-web

# Health checks
curl -fsS https://core.carinaai.uk/health
curl -fsS https://app.carinaai.uk/
curl -fsS https://console.labyrinthscout.com/api/health
```

---

**Last updated:** 2026-06-25. For product-specific notes see `AGENTS.md` and per-package README files.
