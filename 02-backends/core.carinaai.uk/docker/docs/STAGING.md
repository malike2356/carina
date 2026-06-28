# Staging environment (Docker)

Last updated: 2026-06-25

Staging runs on the **same VPS** as production using `docker-compose.staging.yml`. It is not PM2 or `/var/www/staging.*/releases/`.

## Domains

| Domain | Container | Internal port |
|--------|-----------|---------------|
| staging.core.carinaai.uk | carina-staging-web | 3000 |
| staging.app.carinaai.uk | carina-staging-cloud | 4100 |
| staging.admin.carinaai.uk | carina-staging-admin | 4200 |

Nginx: `docker/nginx/staging.carinaai.uk.conf`. IP allowlist is **off for GTM launch** (post-GTM: `docker/config/gtm-rollout.json`).

## Feature flags (recommended)

| Variable | Staging value |
|----------|---------------|
| `NODE_ENV` | `staging` |
| `AIVA_SCOUT_FLEET_ENABLED` | `false` |
| `AIVA_CHAIN_ATTEST_ENABLED` | `false` |
| `RESEND_PREVIEW_MODE` | `true` (log emails, do not send) |
| Stripe keys | `sk_test_...` / `whsec_test_...` only |

## Setup (once on VPS)

```bash
cd /home/malike/apps/core.carinaai.uk
cp .env.staging.example .env.staging.runtime
cp .env.staging.cloud.example .env.staging.cloud.runtime
cp .env.staging.admin.example .env.staging.admin.runtime
# Edit secrets; keep ADMIN_TOKEN_SECRET / ADMIN_SETUP_TOKEN in sync across core + admin files

bash docker/scripts/deploy-staging.sh
bash docker/scripts/seed-staging.sh
```

## Deploy

```bash
bash docker/scripts/deploy-staging.sh
# or from repo root:
bash scripts/deploy-staging.sh
```

Atomic build, tag, health-check, and rollback: `docker/scripts/deploy-staging-atomic.sh`

```bash
bash docker/scripts/deploy-staging-atomic.sh --rollback carina-web-staging
```

## Database

- DB: `carina_staging` on `postgres-staging` (volume `pgdata-staging`)
- Apps connect via `pgbouncer-staging:6432`
- Migrations run automatically before `carina-web-staging` deploy (history: `.deploy/staging-migration-history.log`)

## Seed data

```bash
bash docker/scripts/seed-staging.sh
```

Creates trial workspace, sample Aiva worker, and bootstrap admin operator.

Credentials (set in `.env.staging.runtime`, not committed):

- Admin API: `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD`
- Contact email: `STAGING_CONTACT_EMAIL` or default `test@staging.carinaai.uk`

Smoke test admin auth:

```bash
CORE_URL=http://localhost:3000 bash docker/scripts/test-admin-staging-auth.sh
```

## Smoke checks

```bash
curl -fsS https://staging.core.carinaai.uk/health
curl -fsS https://staging.app.carinaai.uk/api/health
curl -fsS https://staging.admin.carinaai.uk/api/health
```

## Migration workflow

See `MIGRATION-PROCEDURE.md` (staging-first section).

## Optional flags

| Flag | Effect |
|------|--------|
| `SKIP_CLOUD=1` | Deploy core only |
| `SKIP_ADMIN=1` | Skip admin Next.js container |
