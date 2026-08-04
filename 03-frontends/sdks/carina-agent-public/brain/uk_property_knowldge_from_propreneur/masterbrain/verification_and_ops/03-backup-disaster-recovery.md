# Backup and disaster recovery (platform)

**Last updated:** 2026-05-03

Central-only module: PostgreSQL dumps, optional filesystem snapshots, schedules, remote destinations, encryption, verification, and a gated restore queue. Tenant users do not see this surface; it is for platform operators on the central domain.

## Admin UI

- **Jobs:** `GET /admin/backups` (`admin.backups.index`) - list recent `backup_jobs`, queue manual runs, download completed archives, queue restore, delete rows and files (requires `manage-backups` for mutating actions).
- **Destinations:** `GET /admin/backups/destinations` - `local` (extra copy path in JSON `{"path":"..."}`) or `s3` (requires `aws/aws-sdk-php`; bucket, region, key, secret, optional prefix in JSON).
- **Schedules:** `GET /admin/backups/schedules` - `type` (`database` | `files` | `both`), `frequency` (`hourly` | `daily` | `weekly` | `monthly`), retention days, optional destination. Cron should run `php artisan backup:schedule` every minute (Laravel scheduler already registers it with `withoutOverlapping`).

Feature flags: **`platform_backup_dr`** (main module; catalogue in `App\Support\PlatformFeatureCatalogue`), **`platform_backup_slack_notify`** (optional; default off). When the Slack flag is on and **`BACKUP_SLACK_WEBHOOK_URL`** is set, **`App\Listeners\Central\NotifySlackOnBackupCompleted`** posts a short summary to an Incoming Webhook after each successful job. Permissions: **`view-backups`**, **`manage-backups`** (see central migration `2026_05_04_120001_add_backup_platform_permissions.php` and `config/platform_permissions.php`).

## Database tables (central connection)

| Table | Purpose |
|-------|---------|
| `backup_destinations` | Named targets (`driver`, `config` JSON, `is_primary`). |
| `backup_schedules` | Recurrence and retention; `next_run_at` advanced when a scheduled job is dispatched. |
| `backup_jobs` | Each run: `uuid`, `type`, `status`, `path` (relative to backup disk), `checksum` (SHA-256), `size_bytes`, `retention_days`, optional FKs, `metadata` JSON. |
| `restore_jobs` | Queued restore attempts: `backup_job_id`, `status`, `target_tenant_slug`, `logs` JSON. |

## Artisan commands

| Command | Role |
|---------|------|
| `backup:run --type=database\|files\|both [--name=] [--sync]` | Queue or run (`--sync`) one job. |
| `backup:list [--limit=]` | Tabular listing. |
| `backup:cleanup [--sync]` | Dispatches `CleanupExpiredBackupsJob` (retention vs `created_at`). |
| `backup:verify {id}` | Numeric `backup_jobs.id`; checksum and file presence. |
| `backup:restore {id} [--tenant=]` | Creates `restore_jobs` and dispatches `ProcessRestoreJob`. |
| `backup:schedule` | Dispatches due schedules inside DB transactions with `lockForUpdate`. |

## Services and jobs

- **`App\Services\Backup\BackupService`** - orchestrates zip layout (`central.sql`, `tenants/{slug}.sql`, optional paths from `config/backup.php` `file_paths`), `pg_dump` via **`PostgresBackupDumper`**, optional AES-256-GCM encryption (`BACKUP_ENCRYPTION_KEY` 64 hex chars), checksum, `BackupJobCompleted` event for downstream automation listeners.
- **`BackupDestinationService`**, **`BackupEncryptionService`**, **`BackupVerificationService`**, **`BackupScheduleService`**, **`BackupCarinaBriefing`** (platform Carina prompt appendix).
- **Jobs:** `RunBackupJob`, `UploadBackupJob`, `VerifyBackupJob`, `CleanupExpiredBackupsJob`, `ProcessRestoreJob` (restore is blocked unless `BACKUP_RESTORE_ALLOWED=true`; in `APP_ENV=testing` it completes as simulated).

Work directory for zips: `storage/framework/cache/backup-work/{uuid}` (writable under normal Laravel permissions).

## Configuration (`config/backup.php`)

- `BACKUP_DISK` (default `local`), `BACKUP_ROOT` (default `platform-backups` under that disk).
- `BACKUP_PG_DUMP_PATH`, `BACKUP_PSQL_PATH`.
- `BACKUP_ENCRYPTION_KEY` - optional 64 hex chars.
- `BACKUP_RESTORE_ALLOWED` - default false; never enable on a shared app host without an isolated recovery plan.
- `BACKUP_INCLUDE_TENANT_DBS` - when true, iterates central `tenants` and dumps each tenant database using `tenant_template` connection settings with overridden database name.
- `BACKUP_SLACK_WEBHOOK_URL` - optional Slack Incoming Webhook URL; used only when feature **`platform_backup_slack_notify`** is enabled in central feature flags.

## Point-in-time recovery

Continuous archiving and PITR are PostgreSQL operator concerns (WAL shipping, base backups). This module stores logical dumps and file snapshots; pair with infra-level WAL archiving for true PITR. Document your RPO/RTO in your own runbook.

## Carina and automation

- Platform Carina receives the recent-job summary (see **`08-carina.md`**).
- **`App\Events\Central\BackupJobCompleted`** fires after a successful job. **`App\Listeners\Central\LogBackupJobCompleted`** is registered in **`AppServiceProvider`** and writes **`backup.job.completed`** to the application log (id, uuid, name, type, status, size, schedule and destination ids). **`App\Listeners\Central\NotifySlackOnBackupCompleted`** is also registered (queued listener; runs when **`platform_backup_slack_notify`** and **`BACKUP_SLACK_WEBHOOK_URL`** are set).

## `.env` fragment (optional)

This repository may not ship **`.env.example`**; copy these into your local **`.env`** when you enable backups in non-default ways:

```
BACKUP_DISK=local
BACKUP_ROOT=platform-backups
# BACKUP_ENCRYPTION_KEY=   # 64 hex chars (32 bytes), e.g. from php -r "echo bin2hex(random_bytes(32));"
BACKUP_RESTORE_ALLOWED=false
BACKUP_INCLUDE_TENANT_DBS=true
# BACKUP_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...   # optional; enable platform_backup_slack_notify
# BACKUP_PG_DUMP_PATH=/usr/bin/pg_dump
```

## DevAccountSeeder (2026-05-03)

Re-running **`php artisan app:reseed-dev-accounts`** no longer resets passwords for an existing platform super-admin (`lordsesame@gmail.com`) or the existing Xelox tenant user (`xeloxproperties@gmail.com`); it still refreshes roles, active flags, and metadata as before.

## Tests

- `tests/Feature/Central/BackupAdminTest.php` - admin hub, restore probe, destination test, and Slack webhook listener cases (same `RefreshDatabase` lifecycle).
- `tests/Feature/Central/BackupVerificationTest.php`
- `tests/Unit/Backup/BackupEncryptionTest.php`

Run: `php artisan test --filter=Backup`.
