# Sprint 4 - Prompt i/01: Staging Environment

**Status: COMPLETED 2026-06-25**

**What was built:**
- `docker-compose.staging.yml` (core, cloud, admin, postgres-staging, pgbouncer-staging, redis-staging)
- `docker-compose.staging.deploy.yml` (tagged release images for rollback)
- `docker/scripts/deploy-staging.sh` (full stack deploy)
- `docker/scripts/deploy-staging-atomic.sh` (atomic build, migrations, health-check, rollback)
- `docker/scripts/sync-staging-env.py`, `seed-staging.sh`, `scripts/seed-staging.ts`
- `docker/scripts/test-admin-staging-auth.sh`
- `docker/nginx/staging.carinaai.uk.conf` (core, app, admin; IP-restricted)
- `.env.staging.example`, `.env.staging.cloud.example`, `.env.staging.admin.example`
- `03-frontends/client-apps/admin.carinaai.uk/docker/Dockerfile.runtime`
- `scripts/deploy-staging.sh` (repo-root wrapper)
- `docker/docs/STAGING.md`, `MIGRATION-PROCEDURE.md` staging-first workflow

**Sprint:** 4 - Foundation
**Prompt number:** i/01

---

## Done When

- [x] `carina_staging` database via `postgres-staging` Docker volume
- [x] Staging env files (core, cloud, admin) with Stripe test mode and feature flags
- [x] `RESEND_PREVIEW_MODE=true` documented in `.env.staging.example`
- [x] Docker staging deploy (not PM2 `/var/www/staging.*`)
- [x] Atomic deploy + `--rollback` via `deploy-staging-atomic.sh`
- [x] Nginx staging config for core, app, and admin subdomains (IP-restricted)
- [x] TLS via production wildcard cert (`carinaai.uk` SAN)
- [x] `seed-staging.sh` seeds workspace, worker, admin operator
- [x] Bootstrap credentials via env vars (not in git)
- [x] Migration procedure includes staging-first steps
- [x] Health endpoints for staging core, app, and admin

**Note:** Production uses Docker Compose on the same VPS, not PM2. PM2 ecosystem files from the original prompt are not used.
