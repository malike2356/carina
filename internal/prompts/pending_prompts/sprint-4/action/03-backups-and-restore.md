# Sprint 7 - Prompt 03: Backups and Restore

**Sprint:** 7 - Infrastructure
**Prompt number:** 03 of 04
**Name:** PostgreSQL automated backups, off-site storage, retention, verified restore procedure
**Primary agent:** Claude Code
**Estimated hours:** 4-6 h
**Depends on:** Nothing. Can build independently.

---

## Post-build (MANDATORY)

When all "Done When" criteria below are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Add a "**What was built:**" bullet list.
3. Move this file to `internal/prompts/archived_prompts/archives_from_pending_prompts/sprint-7/infra/`.

---

## Read First

1. Run `psql -U postgres -c '\l'` on VPS to list all databases; identify the Aiva production DB name
2. Run `pg_dump --version` on VPS to confirm pg_dump version
3. Check if `rclone` is installed: `rclone version`; if not, the setup step below covers installation
4. Check disk space: `df -h /var/backups`; the local backup dir needs enough space for 7 daily dumps

---

## Context

The tables that cannot be recreated if lost:

- `workspaces` and `users` - all customer accounts
- `ai_workers` - all Aiva configurations
- `ai_worker_activity` - conversation history and audit trail
- `ai_worker_automations` - scheduled task configs
- `aiva_subscriptions` and `aiva_invoices` - all billing records
- `aiva_escalations` - human VA queue history
- `scout_signal_cache` - rogue detection event history
- `admin_audit_log` - all admin actions (needed for compliance)

An untested backup is not a backup. This prompt includes a restore test procedure that must be
run after the backup system is set up and then weekly thereafter (or as part of the monitoring
checks in prompt 04).

---

## Step 1: Backup script

Identify the production database name from `psql -U postgres -c '\l'` and set it as the
`DB_NAME` variable. Do not hardcode it in the script - read from the shared `.env` file.

Create `/opt/verlox/scripts/backup-postgres.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Load env
# shellcheck source=/dev/null
source /var/www/core.carinaai.uk/shared/.env

DB_NAME="${POSTGRES_DB:-carina_production}"
DB_USER="${POSTGRES_USER:-postgres}"
BACKUP_DIR="/var/backups/postgres/daily"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.dump"
LOG_FILE="/var/log/verlox/backup.log"

mkdir -p "$BACKUP_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "Starting backup: $DB_NAME -> $BACKUP_FILE"

# pg_dump in custom format (compressed, supports selective restore)
pg_dump \
  -U "$DB_USER" \
  -Fc \
  --no-password \
  "$DB_NAME" \
  > "$BACKUP_FILE"

BACKUP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
log "Backup complete: $BACKUP_FILE ($BACKUP_SIZE)"

# Upload to off-site storage
rclone copy "$BACKUP_FILE" "backblaze:verlox-backups/postgres/daily/" \
  --log-level INFO \
  --log-file "$LOG_FILE"

log "Uploaded to Backblaze: verlox-backups/postgres/daily/$(basename "$BACKUP_FILE")"

# Write a heartbeat marker for monitoring (prompt 04 reads this)
date +%s > /var/log/verlox/backup-last-success.epoch

log "Done."
```

Make executable: `chmod +x /opt/verlox/scripts/backup-postgres.sh`

---

## Step 2: Retention script

Create `/opt/verlox/scripts/backup-retention.sh`:

```bash
#!/usr/bin/env bash
# Prunes local backup files according to retention policy:
# - Keep all backups from the last 7 days (daily retention)
# - Keep one backup per week for the last 4 weeks (weekly retention: Sunday backups)
# - Keep one backup per month for the last 3 months (monthly retention: 1st of month backups)
# - Delete everything older than 3 months
set -euo pipefail

BACKUP_DIR="/var/backups/postgres/daily"
LOG_FILE="/var/log/verlox/backup.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] retention: $*" | tee -a "$LOG_FILE"
}

find_older_than_days() {
  find "$BACKUP_DIR" -maxdepth 1 -name "*.dump" -mtime +"$1" | sort
}

# Files older than 90 days: delete unconditionally
while IFS= read -r f; do
  [ -f "$f" ] || continue
  log "Deleting (>90 days): $f"
  rm -f "$f"
done < <(find_older_than_days 90)

# Files between 7 and 90 days: keep only Sunday and 1st-of-month backups
while IFS= read -r f; do
  [ -f "$f" ] || continue
  # Extract date from filename: DB_NAME_YYYYMMDD-HHMMSS.dump
  filename=$(basename "$f")
  date_part=$(echo "$filename" | grep -oP '\d{8}')
  [ -z "$date_part" ] && continue
  year="${date_part:0:4}"
  month="${date_part:4:2}"
  day="${date_part:6:2}"
  dow=$(date -d "${year}-${month}-${day}" +%u 2>/dev/null || date -j -f "%Y%m%d" "$date_part" +%u 2>/dev/null)

  # Keep if Sunday (dow=7) or 1st of month
  if [ "$dow" = "7" ] || [ "$day" = "01" ]; then
    log "Keeping (weekly/monthly): $f"
  else
    log "Deleting (outside retention): $f"
    rm -f "$f"
  fi
done < <(find_older_than_days 7 | grep -v "$(find_older_than_days 90 | xargs -r echo)")

# Also prune Backblaze (remote retention mirrors local)
rclone delete "backblaze:verlox-backups/postgres/daily/" \
  --min-age 91d \
  --log-level INFO \
  --log-file "$LOG_FILE" \
  || log "WARNING: remote retention prune failed (non-fatal)"

log "Retention complete."
```

Make executable: `chmod +x /opt/verlox/scripts/backup-retention.sh`

---

## Step 3: rclone setup for Backblaze B2

Install rclone if not present:
```bash
curl https://rclone.org/install.sh | bash
```

Create a Backblaze B2 account and bucket:
- Bucket name: `verlox-backups`
- Bucket type: Private
- Create an Application Key with read/write access to `verlox-backups` only

Configure rclone:
```bash
rclone config
# Name: backblaze
# Type: b2
# Account ID: [B2 account ID]
# Application Key: [B2 application key]
# Hard delete: No
```

Test connection:
```bash
rclone ls backblaze:verlox-backups/
```

Store the rclone config path in `infrastructure/VPS-SETUP.md`.
The rclone config contains B2 credentials - it lives only on the VPS, never in the repo.

---

## Step 4: Backup cron

Add to VPS crontab (`crontab -e` as root or the user that owns the DB):

```cron
# Postgres backup - runs at 02:00 UTC daily
0 2 * * * /opt/verlox/scripts/backup-postgres.sh >> /var/log/verlox/backup.log 2>&1

# Retention - runs at 03:00 UTC daily (after backup completes)
0 3 * * * /opt/verlox/scripts/backup-retention.sh >> /var/log/verlox/backup.log 2>&1
```

Also add a weekly restore test (see Step 7):
```cron
# Weekly restore test - Sunday 04:00 UTC
0 4 * * 0 /opt/verlox/scripts/backup-restore-test.sh >> /var/log/verlox/backup-restore-test.log 2>&1
```

---

## Step 5: pg_hba.conf - passwordless local backup

To allow `pg_dump` to run without a password prompt in cron:

Add to `/etc/postgresql/*/main/pg_hba.conf`:
```
local   [DB_NAME]   [DB_USER]   trust
```

Or create a `.pgpass` file for the user running cron:
```
# ~/.pgpass
localhost:5432:[DB_NAME]:[DB_USER]:[PASSWORD]
chmod 600 ~/.pgpass
```

Test: `pg_dump -U [DB_USER] [DB_NAME] > /dev/null && echo "pg_dump works"` without being prompted for a password.

---

## Step 6: Restore procedure

Document in `infrastructure/RESTORE-PROCEDURE.md`:

```markdown
# PostgreSQL Restore Procedure

## When to use this

- Production database is corrupt, inaccessible, or accidentally wiped.
- A data error was introduced and the corrupted data must be replaced with a good snapshot.

## Step 1: Identify the backup to restore

List available backups:
  rclone ls backblaze:verlox-backups/postgres/daily/

Backups are named: [DB_NAME]_YYYYMMDD-HHMMSS.dump
Download the target backup:
  rclone copy "backblaze:verlox-backups/postgres/daily/[filename]" /tmp/

## Step 2: Stop the application

  pm2 stop all
  # Verify no connections remain:
  psql -U postgres -c "SELECT count(*) FROM pg_stat_activity WHERE datname = '[DB_NAME]';"

## Step 3: Drop and recreate the database

  psql -U postgres -c "DROP DATABASE [DB_NAME];"
  psql -U postgres -c "CREATE DATABASE [DB_NAME] OWNER [DB_USER];"

## Step 4: Restore from backup

  pg_restore \
    -U postgres \
    -d [DB_NAME] \
    --no-owner \
    --role=[DB_USER] \
    -v \
    /tmp/[backup_filename].dump

  Expect this to take 1-10 minutes depending on database size.

## Step 5: Verify the restore

  psql -U postgres -d [DB_NAME] -c "SELECT COUNT(*) FROM workspaces;"
  psql -U postgres -d [DB_NAME] -c "SELECT COUNT(*) FROM aiva_subscriptions;"
  psql -U postgres -d [DB_NAME] -c "SELECT MAX(created_at) FROM ai_worker_activity;"
  # Confirm the latest record date matches expectations for the chosen backup

## Step 6: Run any pending migrations

  cd /var/www/core.carinaai.uk/current
  # Check migration history vs migration files; apply any that were created after the backup date

## Step 7: Restart the application

  pm2 start all

## Step 8: Verify the application is healthy

  curl https://core.carinaai.uk/health
  curl https://app.carinaai.uk/api/health
  # Check recent logs: pm2 logs --lines 50
```

---

## Step 7: Restore test script (automated weekly)

Create `/opt/verlox/scripts/backup-restore-test.sh`:

```bash
#!/usr/bin/env bash
# Automated weekly restore test
# Downloads the latest backup, restores it to a test database, runs schema checks, drops test DB.
# Does NOT touch the production database.
set -euo pipefail

source /var/www/core.carinaai.uk/shared/.env

DB_NAME="${POSTGRES_DB:-carina_production}"
DB_USER="${POSTGRES_USER:-postgres}"
TEST_DB="${DB_NAME}_restore_test"
BACKUP_DIR="/tmp/restore-test"
LOG_FILE="/var/log/verlox/backup-restore-test.log"
ALERT_EMAIL="lordsesame@gmail.com"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
fail() {
  log "RESTORE TEST FAILED: $*"
  echo "Verlox backup restore test FAILED on $(hostname): $*" \
    | mail -s "BACKUP RESTORE TEST FAILED" "$ALERT_EMAIL" 2>/dev/null || true
  exit 1
}

log "=== Weekly restore test starting ==="

mkdir -p "$BACKUP_DIR"

# Get the latest backup filename from Backblaze
LATEST=$(rclone lsf "backblaze:verlox-backups/postgres/daily/" \
  --format "t;n" | sort -r | head -1 | cut -d';' -f2)

[ -z "$LATEST" ] && fail "No backups found in Backblaze"
log "Latest backup: $LATEST"

# Download it
rclone copy "backblaze:verlox-backups/postgres/daily/$LATEST" "$BACKUP_DIR/"
BACKUP_FILE="$BACKUP_DIR/$LATEST"
[ -f "$BACKUP_FILE" ] || fail "Download failed: $BACKUP_FILE not found"
log "Downloaded: $BACKUP_FILE ($(du -sh "$BACKUP_FILE" | cut -f1))"

# Drop test DB if it exists (from a previous failed test)
psql -U "$DB_USER" -c "DROP DATABASE IF EXISTS $TEST_DB;" postgres

# Create test DB
psql -U "$DB_USER" -c "CREATE DATABASE $TEST_DB OWNER $DB_USER;" postgres

# Restore
pg_restore \
  -U "$DB_USER" \
  -d "$TEST_DB" \
  --no-owner \
  --role="$DB_USER" \
  "$BACKUP_FILE" \
  || fail "pg_restore exited with error"

log "Restore complete. Running schema checks..."

# Schema checks - all critical tables must exist and have rows
check_table() {
  local table="$1"
  local min_rows="${2:-0}"
  local count
  count=$(psql -U "$DB_USER" -d "$TEST_DB" -t -c "SELECT COUNT(*) FROM $table;" | tr -d ' ')
  if [ "$count" -lt "$min_rows" ]; then
    fail "Table $table has $count rows (expected >= $min_rows)"
  fi
  log "  $table: $count rows - OK"
}

check_table workspaces 0
check_table users 0
check_table ai_workers 0
check_table ai_worker_activity 0
check_table aiva_subscriptions 0
check_table admin_audit_log 0

# Check that restored data is recent (last activity should be within 25h of backup timestamp)
LAST_ACTIVITY=$(psql -U "$DB_USER" -d "$TEST_DB" -t -c \
  "SELECT EXTRACT(EPOCH FROM (NOW() - MAX(created_at))) FROM ai_worker_activity;" | tr -d ' ')

# If LAST_ACTIVITY is empty (no activity yet), skip this check
if [ -n "$LAST_ACTIVITY" ] && [ "$(echo "$LAST_ACTIVITY > 90000" | bc)" = "1" ]; then
  log "WARNING: last activity is more than 25 hours old ($LAST_ACTIVITY seconds)"
  # Not a failure - could be a new deployment with no traffic yet
fi

# Drop test DB
psql -U "$DB_USER" -c "DROP DATABASE $TEST_DB;" postgres
log "Test DB dropped."

# Cleanup
rm -f "$BACKUP_FILE"

# Write success marker
date +%s > /var/log/verlox/restore-test-last-success.epoch

log "=== Restore test PASSED ==="
```

Make executable: `chmod +x /opt/verlox/scripts/backup-restore-test.sh`

---

## Step 8: Backup size monitoring

Add to `/opt/verlox/scripts/backup-postgres.sh` (after the upload step):

```bash
# Alert if backup is suspiciously small (less than 100KB may indicate empty dump)
BACKUP_BYTES=$(stat -c%s "$BACKUP_FILE")
if [ "$BACKUP_BYTES" -lt 102400 ]; then
  log "WARNING: Backup file is very small ($BACKUP_BYTES bytes). Verify it is complete."
  echo "Verlox backup warning: backup file is only ${BACKUP_BYTES} bytes on $(date)" \
    | mail -s "BACKUP SIZE WARNING" lordsesame@gmail.com 2>/dev/null || true
fi
```

---

## Step 9: Point-in-time recovery option (WAL archiving)

For higher durability, enable WAL archiving to recover to any point in time, not just daily snapshot times. This is optional at launch but should be enabled once the product has paying customers.

Document in `infrastructure/VPS-SETUP.md`:

```markdown
## WAL Archiving (optional - enable for higher durability)

1. Set in /etc/postgresql/*/main/postgresql.conf:
   wal_level = replica
   archive_mode = on
   archive_command = 'rclone copy %p backblaze:verlox-backups/wal/%f'

2. Restart PostgreSQL: systemctl restart postgresql

3. WAL segments accumulate in Backblaze: verlox-backups/wal/
   Add a retention policy: rclone delete backblaze:verlox-backups/wal/ --min-age 7d (run daily)

4. To restore to a point in time, combine the nearest daily dump with WAL replay.
   Follow PostgreSQL docs on point-in-time recovery.

Enable this before the first month of paid subscriptions is live.
```

---

## Done When

- [ ] `/opt/verlox/scripts/backup-postgres.sh` runs without error and produces a `.dump` file
- [ ] Backup file is uploaded to Backblaze B2 bucket `verlox-backups/postgres/daily/`
- [ ] `rclone ls backblaze:verlox-backups/` shows the uploaded file
- [ ] `/opt/verlox/scripts/backup-retention.sh` runs without error; old files are removed per policy
- [ ] Backup cron at 02:00 UTC registered in crontab; retention cron at 03:00 UTC registered
- [ ] `pg_dump` runs in cron without password prompt (pgpass or trust configured)
- [ ] `/opt/verlox/scripts/backup-restore-test.sh` completes successfully (creates test DB, restores, checks tables, drops test DB)
- [ ] Restore test cron at 04:00 UTC Sundays registered in crontab
- [ ] Restore test failure sends alert email
- [ ] `infrastructure/RESTORE-PROCEDURE.md` exists with step-by-step instructions
- [ ] Backup size warning alert fires when backup is under 100KB
- [ ] `/var/log/verlox/backup-last-success.epoch` written after every successful backup (used by monitoring in prompt 04)
- [ ] `/var/log/verlox/restore-test-last-success.epoch` written after every successful restore test
- [ ] WAL archiving section documented in `VPS-SETUP.md`
- [ ] rclone config on VPS is only readable by root (`chmod 600 ~/.config/rclone/rclone.conf`)
- [ ] Backblaze bucket is private; the Application Key has no public read access
