# PostgreSQL restore (Docker production)

## When to use

- Production database is corrupt, inaccessible, or accidentally wiped.
- A bad migration or data error must be rolled back to a known-good snapshot.

## Critical data in backups

These tables cannot be recreated from scratch if lost:

| Table | Contents |
|-------|----------|
| `workspaces`, `users` | Customer accounts |
| `ai_workers` | Aiva configurations |
| `ai_worker_activity` | Conversation history and audit trail |
| `ai_worker_automations` | Scheduled task configs |
| `aiva_subscriptions`, `aiva_invoices` | Billing records |
| `aiva_escalations` | Human VA queue history |
| `scout_signal_cache` | Rogue detection event history |
| `admin_audit_log` | Admin actions (compliance) |

## Step 1: Identify the backup to restore

List local backups:

```bash
ls -lh /var/backups/postgres/daily/
```

List off-site backups (Backblaze B2 via rclone):

```bash
rclone ls backblaze:verlox-backups/postgres/daily/
```

Backups are named: `carina_YYYYMMDD-HHMMSS.dump` (or `${POSTGRES_DB}_...` if customized).

Download a remote backup:

```bash
rclone copy "backblaze:verlox-backups/postgres/daily/carina_YYYYMMDD-HHMMSS.dump" /tmp/
```

## Step 2: Stop the application

Keep the `postgres` container running; stop app containers only:

```bash
cd /home/malike/apps/core.carinaai.uk
docker compose -f docker-compose.prod.yml stop carina-web carina-hub carina-ops carina-cloud
```

Verify no app connections remain:

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U carina -d postgres -c \
  "SELECT count(*) FROM pg_stat_activity WHERE datname = 'carina';"
```

## Step 3: Drop and recreate the database

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U carina -d postgres -c "DROP DATABASE carina;"
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U carina -d postgres -c "CREATE DATABASE carina OWNER carina;"
```

Replace `carina` with `${POSTGRES_DB}` / `${POSTGRES_USER}` from `/etc/verlox/backup.env` if different.

## Step 4: Restore from backup

```bash
DUMP=/var/backups/postgres/daily/carina_YYYYMMDD-HHMMSS.dump
# or: DUMP=/tmp/carina_YYYYMMDD-HHMMSS.dump

cat "${DUMP}" | docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U carina -d carina --no-owner --role=carina -v
```

Expect 1-10 minutes depending on database size. Some extension or ACL warnings are normal; errors on `DROP` objects that do not exist can be ignored.

## Step 5: Verify the restore

```bash
docker compose -f docker-compose.prod.yml exec -T postgres psql -U carina -d carina -c \
  "SELECT COUNT(*) FROM workspaces;"
docker compose -f docker-compose.prod.yml exec -T postgres psql -U carina -d carina -c \
  "SELECT COUNT(*) FROM aiva_subscriptions;"
docker compose -f docker-compose.prod.yml exec -T postgres psql -U carina -d carina -c \
  "SELECT MAX(created_at) FROM ai_worker_activity;"
```

Confirm row counts and the latest `ai_worker_activity` timestamp match expectations for the chosen backup date.

## Step 6: Run pending migrations

If the backup predates recent schema changes:

```bash
cd /home/malike/apps/core.carinaai.uk
bash docker/scripts/deploy-atomic.sh carina-web
```

## Step 7: Restart the application

```bash
bash docker/scripts/deploy-prod.sh
```

## Step 8: Verify application health

```bash
curl -fsS https://core.carinaai.uk/health
curl -fsS https://app.carinaai.uk/api/health
docker compose -f docker-compose.prod.yml logs carina-web --tail=50
```

`/health` includes `checks.backup` from `/var/log/verlox/backup-last-success.epoch`.

## Automated restore test

Weekly cron runs `docker/scripts/backup-restore-test.sh` (Sunday 04:00 UTC). It restores the latest off-site dump into `${POSTGRES_DB}_restore_test`, verifies critical tables, then drops the test database. Success marker: `/var/log/verlox/restore-test-last-success.epoch`.

## Point-in-time recovery (WAL archiving)

Daily `pg_dump` files give RPO up to 24 hours. For point-in-time recovery, enable WAL archiving first (see `INFRASTRUCTURE.md` WAL section). PITR combines the nearest daily dump with WAL replay per [PostgreSQL continuous archiving](https://www.postgresql.org/docs/current/continuous-archiving.html).

If WAL archiving is not enabled, use the latest daily dump only.
