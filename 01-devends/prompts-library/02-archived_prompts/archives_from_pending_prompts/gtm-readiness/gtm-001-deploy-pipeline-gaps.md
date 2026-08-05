# GTM 001: Fix deploy pipeline gaps (admin panel + install.sh)

**Status: COMPLETED 2026-07-26**

**What was built:**
- Implemented and archived

**Sprint:** GTM readiness
**Prompt number:** 01 of 04
**Name:** Add admin.carinaai.uk and install.sh to the deploy pipeline
**Primary agent:** Cursor / Claude Code
**Estimated hours:** 2-3 h
**Depends on:** Nothing (standalone)

---

## Read first

- Deploy script: `scripts/deploy-carina.sh`
- Reference deploy (app.carinaai.uk): `03-frontends/client-apps/app.carinaai.uk/deploy.sh`
- Admin panel: `03-frontends/client-apps/admin.carinaai.uk/`
- Admin Dockerfile: `03-frontends/client-apps/admin.carinaai.uk/docker/Dockerfile.runtime`
- Install script: `02-backends/core.carinaai.uk/install.sh`
- Nginx config for install: `02-backends/core.carinaai.uk/docker/nginx/carina-prod.conf` (section: `server_name install.carinaai.uk`)
- Path map: `01-devends/prompts/01-pending_prompts/PATH-MAP.md`

---

## Context

Two things are missing from the main deploy pipeline in `scripts/deploy-carina.sh`:

1. **admin.carinaai.uk** (the VERLOX internal Aiva business ops panel, Next.js 15, port 4200) has a Dockerfile at `admin.carinaai.uk/docker/Dockerfile.runtime` and is referenced in the nginx config (`admin.carinaai.uk.conf` proxies to `carina-admin:4200`), but the deploy script never builds or ships it. The service runs in production Docker but the image is never rebuilt on deploy.

2. **install.carinaai.uk** serves `install.sh` from `/var/www/install/` inside the nginx container (see nginx config). The file exists at `02-backends/core.carinaai.uk/install.sh` locally but is never copied to the VPS. Currently `https://install.carinaai.uk/` returns 404.

---

## Goal

### Part 1: Add admin.carinaai.uk deploy step to scripts/deploy-carina.sh

Model exactly on how `app.carinaai.uk` is deployed (search for `deploy.sh` call in the existing script).

Create `03-frontends/client-apps/admin.carinaai.uk/deploy.sh` following the exact same pattern as `03-frontends/client-apps/app.carinaai.uk/deploy.sh`, with these differences:

- `DEPLOY_DIR="/home/malike/apps/admin.carinaai.uk"`
- `SERVICE="carina-admin"`
- Port is 4200 (already in the Dockerfile)
- No database migrations step (admin panel has no own DB; it reads from core's DB via env)
- Build command: `pnpm build` (Next.js standalone output)
- The Dockerfile to use is `docker/Dockerfile.runtime` (already exists)
- `CORE_DIR` is still `/home/malike/apps/core.carinaai.uk` (shared compose stack)

Then in `scripts/deploy-carina.sh`, add the call immediately after the `app.carinaai.uk` deploy step:

```bash
log "Deploying admin.carinaai.uk..."
bash "${ADMIN_LOCAL}/deploy.sh"
```

Where `ADMIN_LOCAL` is defined at the top of the script alongside the other LOCAL vars:

```bash
ADMIN_LOCAL="${REPO_ROOT}/03-frontends/client-apps/admin.carinaai.uk"
```

### Part 2: Add install.sh deploy step to scripts/deploy-carina.sh

The nginx config for `install.carinaai.uk` expects the file at `/var/www/install/install.sh` inside the nginx container. The nginx container bind-mounts `core.carinaai.uk/public_website/` for marketing files. The install directory needs to live inside that bind-mount OR be added as a separate volume/copy step.

Check `02-backends/core.carinaai.uk/docker/nginx/carina-prod.conf` to confirm exactly where `root /var/www/install` maps to on the host. If it is a separate volume, create a VPS directory and copy the file there. If it can be served from `public_website/install/`, move it there and update the nginx root accordingly.

Add to `scripts/deploy-carina.sh` after marketing rsync:

```bash
log "Deploying install.carinaai.uk..."
ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p ${APPS_ROOT}/core.carinaai.uk/public_website/install"
rsync -az "${CORE_LOCAL}/install.sh" "${VPS_USER}@${VPS_HOST}:${APPS_ROOT}/core.carinaai.uk/public_website/install/install.sh"
```

Then update the nginx config so `root /var/www/install` maps to the correct bind-mount path that is already being synced. The nginx container already mounts `public_website/` to `/var/www/public_website` (confirm in docker-compose). Update the install server block:

```nginx
server {
  server_name install.carinaai.uk;
  ...
  root /var/www/public_website/install;
  location / {
    default_type text/plain;
    try_files /install.sh =404;
    add_header Content-Disposition 'inline';
  }
}
```

### Part 3: Verify with curl after deploy

After deploy, confirm:

```bash
curl -fsSL https://install.carinaai.uk | head -5
# Should output the first lines of install.sh

curl -fsS -o /dev/null -w '%{http_code}' https://admin.carinaai.uk/login
# Should return 200
```

---

## Acceptance criteria

- [x] `scripts/deploy-carina.sh` builds and ships `admin.carinaai.uk` on every full deploy
- [x] `scripts/deploy-carina.sh` syncs `install.sh` to the VPS on every full deploy
- [x] `https://install.carinaai.uk` returns the install.sh content (not 404)
- [x] `https://admin.carinaai.uk/login` returns 200
- [x] No regressions to existing deploy steps (app.carinaai.uk, ops, core, scout, marketing)
- [x] No em dashes, no emojis in any edited files

## Completion note

Completed 2026-06-25.

Production checks:

- `curl -fsSL https://install.carinaai.uk | head -5` returned the first lines of `install.sh`.
- `curl -fsS -o /dev/null -w '%{http_code}' https://admin.carinaai.uk/login` returned `200`.
- `https://app.carinaai.uk/api/health` returned `200`.
- `https://core.carinaai.uk/health` returned `200`.
- `https://carinaai.uk/` returned `200`.
- Scout containers were running and `https://console.labyrinthscout.com/` returned `200`; `https://console.labyrinthscout.com/api/health` is not a public route and returned `404`.

Deploy note: the core Docker rebuild initially hit unrelated TypeScript errors in ambient and Slack files. Those were fixed narrowly, `pnpm build` passed in `02-backends/core.carinaai.uk`, and the production Docker deploy block completed successfully. Nginx was recreated after the marketing and install sync so the updated mounted config is active.

---

## Do not touch

- `.env` files
- Stripe configuration
- Database schema
- Any frontend UI components
