# Prompt 04: Disaster Recovery Runbook and Automated Drills

## Context

The VPS at Contabo 80.190.81.208 holds the production Carina instance. If the VPS is
destroyed or unreachable, recovery from scratch takes unknown time because the runbook is
not documented and no backups are automated. This prompt:
1. Creates the DR runbook
2. Automates daily backups of PostgreSQL data
3. Adds a weekly DR drill that verifies restore procedures

## What to Build

### 1. Automated PostgreSQL backup

Create `docker/scripts/backup.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/app/data/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/carina_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

# Dump and compress
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"

# Keep last 14 daily backups
find "$BACKUP_DIR" -name "carina_*.sql.gz" -mtime +14 -delete

# Upload to object storage (if configured)
if [ -n "${S3_BACKUP_BUCKET:-}" ]; then
  aws s3 cp "$BACKUP_FILE" "s3://${S3_BACKUP_BUCKET}/$(basename $BACKUP_FILE)"
fi

echo "Backup complete: $BACKUP_FILE"
```

Schedule the backup as a Docker cron container or add to the Carina compose stack as a service:
```yaml
carina-backup:
  image: verlox/carina:latest
  command: /bin/bash -c "while true; do sleep 86400; /app/docker/scripts/backup.sh; done"
  restart: unless-stopped
  environment:
    DATABASE_URL: "${DATABASE_URL}"
    S3_BACKUP_BUCKET: "${S3_BACKUP_BUCKET:-}"
  volumes:
    - carina_backups:/app/data/backups
  networks: [carina]
```

### 2. Restore script

Create `docker/scripts/restore.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE="${1:?Usage: restore.sh <backup.sql.gz>}"

echo "Restoring from $BACKUP_FILE..."
echo "WARNING: This will REPLACE all data in the current database."
read -p "Type 'yes' to continue: " confirm
[ "$confirm" = "yes" ] || { echo "Aborted."; exit 1; }

# Drop and recreate
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Restore
gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL"

echo "Restore complete."
```

### 3. DR runbook document

Create `docker/DR_RUNBOOK.md`:
```markdown
# Carina Disaster Recovery Runbook

## RTO Target: 4 hours | RPO Target: 24 hours

## Scenario 1: VPS Lost (Complete Destruction)

1. Provision new VPS (Contabo, same spec: 8 vCPU, 32GB RAM, 200GB SSD, Ubuntu 24.04)
2. SSH in and run: curl -fsSL https://raw.githubusercontent.com/verlox/carina/main/install.sh | bash
3. Download latest backup from S3: aws s3 cp s3://BUCKET/latest.sql.gz ./
4. Run restore: bash docker/scripts/restore.sh latest.sql.gz
5. Update DNS: carinaai.uk A record to new VPS IP
6. Verify: curl https://core.carinaai.uk/health

## Scenario 2: Database Corruption

1. Stop carina-web: docker compose stop carina-web
2. Identify last clean backup: ls -lt /app/data/backups/*.sql.gz | head -5
3. Run restore to the backup immediately before corruption
4. Restart: docker compose start carina-web
5. Verify data integrity: pnpm tsx scripts/verify-audit-chain.ts

## Scenario 3: Carina Process Crash Loop

1. Check containers: docker compose ps
2. Check logs: docker compose logs --tail=100 carina-web
3. Rebuild and redeploy: bash scripts/deploy-carina.sh
```

### 4. Weekly DR drill

Create `src/agents/checks/dr-drill.ts`:
```typescript
// Every Sunday, run a simulated restore on a test schema to verify backup integrity
export async function drDrillCheck(): Promise<AgentCheckResult> {
  if (new Date().getUTCDay() !== 0) return { name: 'dr-drill', urgent: false, summary: null };

  const latestBackup = findLatestBackup('/app/data/backups/');
  if (!latestBackup) {
    return { name: 'dr-drill', urgent: true, summary: 'FAIL: No backup found in /app/data/backups/' };
  }

  // Test restore to a test schema
  const testResult = await testRestore(latestBackup);
  if (!testResult.ok) {
    return { name: 'dr-drill', urgent: true, summary: `FAIL: Restore test failed - ${testResult.error}` };
  }

  const ageHours = (Date.now() - statSync(latestBackup).mtimeMs) / 3600000;
  if (ageHours > 25) {
    return { name: 'dr-drill', urgent: true, summary: `WARNING: Latest backup is ${ageHours.toFixed(0)} hours old` };
  }

  return { name: 'dr-drill', urgent: false, summary: `DR drill passed. Latest backup ${ageHours.toFixed(0)}h old, restore verified.` };
}
```

## Verification Checklist

- [ ] `bash docker/scripts/backup.sh` produces a `.sql.gz` file in `/app/data/backups/`
- [ ] `bash docker/scripts/restore.sh backup.sql.gz` restores correctly (test on a dev DB)
- [ ] Backup is created daily (Docker carina-backup container fires every 24h; verify with `docker compose logs carina-backup`)
- [ ] Backups older than 14 days are deleted
- [ ] Sunday DR drill check reports pass in Carina Sunday briefing

## Files to Create or Modify

- CREATE `docker/scripts/backup.sh`
- CREATE `docker/scripts/restore.sh`
- MODIFY `docker-compose.prod.yml` - add carina-backup service
- CREATE `docker/DR_RUNBOOK.md`
- CREATE `src/agents/checks/dr-drill.ts`
- MODIFY `src/agents/checks/index.ts` - register drDrillCheck
