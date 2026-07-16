# Carina Docker infrastructure (Phase 1)

Production is **Docker Compose only**. Host nginx is not used for Carina domains.

## Quick commands (VPS)

```bash
cd /home/malike/apps/core.carinaai.uk

# Production deploy (atomic)
bash docker/scripts/deploy-prod.sh

# Staging deploy
cp .env.staging.example .env.staging.runtime   # once, edit secrets
cp .env.staging.cloud.example .env.staging.cloud.runtime
cp .env.staging.admin.example .env.staging.admin.runtime
bash docker/scripts/deploy-staging.sh
bash docker/scripts/seed-staging.sh

# Backups
bash docker/scripts/setup-rclone-backup.sh   # once: B2 + /etc/verlox/backup.env
bash docker/scripts/backup-postgres.sh
bash docker/scripts/setup-backup-cron.sh       # once

# Host hardening (once, sudo)
sudo bash docker/scripts/vps-hardening.sh
```

## PgBouncer

- Service: `pgbouncer` on port `6432` (Docker network only)
- Apps connect via `pgbouncer:6432` (default; `sync-*-env.py` sets `PGBOUNCER_ENABLED=1`)
- Staging: `pgbouncer-staging:6432` via `sync-staging-env.py`
- Disable pooler: `PGBOUNCER_ENABLED=0` before running sync scripts
- Full guide: `PGBOUNCER.md` (config, monitoring, reload, incompatibilities)

## Backups

Scripts live in `docker/scripts/` (deployed with core.carinaai.uk). One-time VPS setup:

```bash
cd /home/malike/apps/core.carinaai.uk
bash docker/scripts/setup-rclone-backup.sh   # Backblaze B2 + /etc/verlox/backup.env
bash docker/scripts/setup-backup-cron.sh     # daily backup, retention, weekly restore test
```

| Item | Path |
|------|------|
| Local dumps | `/var/backups/postgres/daily/` |
| Logs | `/var/log/verlox/backup.log`, `backup-restore-test.log` |
| Backup heartbeat | `/var/log/verlox/backup-last-success.epoch` (read by `/health`) |
| Restore-test heartbeat | `/var/log/verlox/restore-test-last-success.epoch` |
| VPS env (not in git) | `/etc/verlox/backup.env` from `docker/scripts/backup.env.example` |
| rclone credentials (VPS only) | `~/.config/rclone/rclone.conf` (`chmod 600`) |

Default off-site remote: `backblaze:verlox-backups/postgres/daily/` (private bucket `verlox-backups`).

Cron schedule (UTC):

| Time | Script |
|------|--------|
| 02:00 daily | `backup-postgres.sh` |
| 03:00 daily | `backup-retention.sh` |
| 03:30 daily | `backup-wal-retention.sh` |
| 04:00 Sunday | `backup-restore-test.sh` |

Restore: `RESTORE-PROCEDURE.md`

### rclone + Backblaze B2 (VPS only)

1. Create a **private** B2 bucket `verlox-backups`.
2. Create an Application Key with read/write on `verlox-backups` only (no public read).
3. On the VPS: `bash docker/scripts/setup-rclone-backup.sh` (installs rclone, runs `rclone config` remote name `backblaze`).
4. Test: `rclone ls backblaze:verlox-backups/`
5. Never commit `rclone.conf` or B2 keys to git.

`pg_dump` runs inside the Docker `postgres` container via `docker compose exec`; no host `pg_hba.conf` changes are required.

### WAL archiving (optional; enable before paid subscriptions)

Point-in-time recovery needs WAL segments in addition to nightly dumps.

1. On the Postgres data volume (or host path bind-mounted for WAL), set in `postgresql.conf` or a custom conf snippet:

   ```
   wal_level = replica
   archive_mode = on
   archive_command = 'test ! -f /var/backups/postgres/wal/%f && cp %p /var/backups/postgres/wal/%f'
   ```

   For off-site WAL, after local copy: `rclone copy /var/backups/postgres/wal/%f backblaze:verlox-backups/wal/%f` (wrap in a small archive script if needed).

2. Restart Postgres: `docker compose -f docker-compose.prod.yml restart postgres`

3. WAL retention: `backup-wal-retention.sh` (cron 03:30 UTC) prunes local and remote WAL older than 7 days.

4. `/health` reports `checks.wal_archive` when `POSTGRES_WAL_ARCHIVE_DIR` or `/var/backups/postgres/wal` has recent files.

5. PITR: combine nearest daily dump with WAL replay (PostgreSQL docs). Enable before the first month of paid subscriptions is live.


## Security

- TLS + HSTS: `docker/nginx/conf.d/ssl-params.conf`
- Rate limits: `docker/nginx/conf.d/security-defaults.conf` (`carina_app_api` 30r/s for app SPA; auth 10r/m). Requires `cloudflare-real-ip.conf` behind Cloudflare.
- CORS allowlist: `src/health/cors-origins.ts` (override with `CORS_ORIGIN` comma list)
- Admin/staging IP allowlists: **off for GTM launch** (`NGINX_*_IP_ALLOWLIST=false`); enable post-GTM per `docker/config/gtm-rollout.json`
- UFW + fail2ban: `docker/scripts/vps-hardening.sh`

## Deferred / optional

- **admin.carinaai.uk TOTP** (enhancement beyond current admin auth)
- **Sentry projects** (create `carina-core`, `carina-app`, `carina-admin` at sentry.io; set DSNs per `ENV-INVENTORY.md`)

## Operations docs

- `ENV-INVENTORY.md` - env var catalog (no secrets)
- `MIGRATION-PROCEDURE.md` - SQL migration and rollback rules
- `SECRET-ROTATION.md` - rotation playbooks
- `MAINTENANCE-SCHEDULE.md` - daily through annual tasks

See also: `DEPLOY.md`, `RESTORE-PROCEDURE.md`, `PGBOUNCER.md`, `ADMIN-IP-ALLOWLIST.md`, `VPS-SECURITY-CLOSEOUT.md`, `STAGING.md`, `UPTIME-MONITORS.md`
