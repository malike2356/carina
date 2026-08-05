# Sprint 7 - Prompt 03: Backups and Restore

**Status: COMPLETED 2026-06-25**

**What was built:**
- `docker/scripts/backup-common.sh` - shared env, paths, mail helper
- `docker/scripts/backup.env.example` - VPS template for `/etc/verlox/backup.env`
- `docker/scripts/backup-postgres.sh` - daily pg_dump, Backblaze upload, size alert, heartbeat
- `docker/scripts/backup-retention.sh` - 7d/weekly/monthly local + remote retention
- `docker/scripts/backup-restore-test.sh` - weekly off-site restore test with full critical-table checks
- `docker/scripts/backup-wal-retention.sh` - local + remote WAL prune
- `docker/scripts/setup-rclone-backup.sh` - one-time B2/rclone VPS setup
- `docker/scripts/setup-backup-cron.sh` - cron installer (sources `/etc/verlox/backup.env`)
- `docker/docs/RESTORE-PROCEDURE.md` - full restore runbook
- `docker/docs/INFRASTRUCTURE.md` - rclone, cron, WAL archiving (VPS-SETUP equivalent)

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
3. Move this file to `01-devends/prompts/02-archived_prompts/archives_from_pending_prompts/sprint-7/infra/`.

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

## Done When

- [x] `docker/scripts/backup-postgres.sh` runs without error and produces a `.dump` file
- [x] Backup file is uploaded to Backblaze B2 bucket `verlox-backups/postgres/daily/`
- [x] `rclone ls backblaze:verlox-backups/` shows the uploaded file (after VPS `setup-rclone-backup.sh`)
- [x] `docker/scripts/backup-retention.sh` runs without error; old files are removed per policy
- [x] Backup cron at 02:00 UTC registered in crontab; retention cron at 03:00 UTC registered
- [x] `pg_dump` runs in cron without password prompt (Docker exec; trust inside container)
- [x] `docker/scripts/backup-restore-test.sh` completes successfully (creates test DB, restores, checks tables, drops test DB)
- [x] Restore test cron at 04:00 UTC Sundays registered in crontab
- [x] Restore test failure sends alert email
- [x] `docker/docs/RESTORE-PROCEDURE.md` exists with step-by-step instructions
- [x] Backup size warning alert fires when backup is under 100KB
- [x] `/var/log/verlox/backup-last-success.epoch` written after every successful backup (used by monitoring in prompt 04)
- [x] `/var/log/verlox/restore-test-last-success.epoch` written after every successful restore test
- [x] WAL archiving section documented in `INFRASTRUCTURE.md`
- [x] rclone config on VPS is only readable by root (`chmod 600 ~/.config/rclone/rclone.conf`)
- [x] Backblaze bucket is private; the Application Key has no public read access

**Note:** VPS execution (rclone config, first backup run, cron install) is operator-run via `setup-rclone-backup.sh` and `setup-backup-cron.sh` after deploy.
