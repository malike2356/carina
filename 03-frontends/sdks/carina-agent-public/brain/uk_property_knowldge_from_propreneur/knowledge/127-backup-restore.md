# Backup & Restore

**Last updated:** 2026-05-17

## Overview
Central backup and restore infrastructure for the platform. Schedule automatic database backups (full or per-tenant), store them to your preferred destination (S3, local storage, SFTP, Google Cloud Storage), set retention periods, verify integrity, and restore when needed.

## Core Features
- **Scheduled backups** - Automatic backups on a schedule (daily, weekly, monthly)
- **Backup types** - Full database or per-tenant backups
- **Multiple destinations** - Store to S3, local filesystem, SFTP, or Google Cloud Storage
- **Retention management** - Set how long backups are kept; expired backups are pruned automatically
- **Integrity verification** - Verify backup checksums to ensure data integrity
- **Restore** - Restore from a backup to any tenant workspace
- **Execution logging** - Full history of backup jobs with status, size, and location

## Getting Started
Backups are configured by platform administrators:
1. Set up backup destinations (S3 bucket, local path, SFTP server, GCS)
2. Create backup schedules with frequency and retention period
3. Backups run automatically on schedule
4. Monitor backup job status and verify integrity
5. Use the restore flow if recovery is needed

## Key Workflows

### Creating a backup schedule
Name your schedule, choose the type (full database or per-tenant), set frequency (daily, weekly, monthly), configure retention period (days to keep backups), select the destination, and activate. The system calculates the next run time automatically.

### Running a manual backup
Trigger an ad-hoc backup from the admin panel. The backup job runs with the same settings as scheduled backups. Track progress through status: pending, running, completed, verified, failed.

### Restoring from a backup
Select a backup job and initiate a restore. Choose the target tenant workspace. The restore process runs and logs all operations. Monitor status: pending, running, completed, failed.

### Integrity verification
Verify a backup by running an integrity check. The system compares the stored checksum against a computed one. Verified backups are marked with "verified" status.

## Business Rules
- Backup jobs are identified by UUID for URL-safe access
- Retention is enforced - expired backups are pruned automatically
- Backups can be verified for integrity after completion
- Restore operations are fully logged for audit
- Schedules track next_run_at and last_run_at
- Each backup destination has its own connection configuration

## Best Practices
- Run daily backups with 30-day retention as a minimum
- Store backups to at least two different destinations
- Verify backup integrity weekly
- Test restores quarterly to ensure backups are working
- Keep backup logs for audit purposes
- Use off-site destinations (S3, GCS) for disaster recovery

## Related Features
- **Security & Activity** - Backup logs support disaster recovery planning
- **Subscriptions & Billing** - Backup policies may vary by plan
