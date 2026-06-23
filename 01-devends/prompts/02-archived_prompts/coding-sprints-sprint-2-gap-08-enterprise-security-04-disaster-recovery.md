# Prompt 04: Disaster Recovery & Business Continuity

**Gap:** 08; Enterprise Security | **Priority:** HIGH | **Build Time:** 2 weeks
**Depends On:** gap-01 (Docker)

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## GOAL

Carina must survive infrastructure failures with defined Recovery Point Objective (RPO) and Recovery Time Objective (RTO). Enterprise customers require this in their SLA before signing.

## SPECIFICATION

### RPO/RTO Targets

| Tier | RPO | RTO | Backup Frequency | Cost |
|------|-----|-----|-----------------|------|
| **Standard** (Monitor/Govern) | 1 hour | 4 hours | Hourly snapshots | Included |
| **Enterprise** | 5 minutes | 15 minutes | Continuous WAL shipping + hourly snapshots | Custom |
| **Premium** | < 1 minute | < 5 minutes | Multi-region active-passive | Custom |

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Primary Region (eu-west-1)            │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │ Carina   │  │ Scout    │  │ PostgreSQL (Primary)  │  │
│  │ Core     │  │ Engine   │  │  • WAL archiving      │  │
│  └────┬─────┘  └────┬─────┘  │  • Hourly snapshots   │  │
│       │              │        │  • pgBackRest         │  │
│       │              │        └──────────┬───────────┘  │
│       │              │                   │               │
│       ▼              ▼                   ▼               │
│  ┌──────────────────────────────────────────────────┐   │
│  │              S3 Backup (eu-west-1)                │   │
│  │  • WAL archives (every 5 min)                     │   │
│  │  • Full backups (hourly)                          │   │
│  │  • Config backups (on change)                     │   │
│  │  • Encrypted with KMS                             │   │
│  └──────────────────────┬───────────────────────────┘   │
└─────────────────────────┼────────────────────────────────┘
                          │ Cross-region replication
┌─────────────────────────▼────────────────────────────────┐
│                  DR Region (us-east-1)                     │
│                                                            │
│  ┌──────────────────────────────────────────────────┐    │
│  │              PostgreSQL (Standby)                  │    │
│  │  • Restore from latest backup + WAL               │    │
│  │  • Promotion script ready                         │    │
│  └──────────────────────────────────────────────────┘    │
│                                                            │
│  ┌──────────────────────────────────────────────────┐    │
│  │              Carina Core (Standby)                 │    │
│  │  • Pre-deployed, stopped                          │    │
│  │  • Config synced from S3                          │    │
│  │  • Health check endpoint: GET /health             │    │
│  └──────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────┘
```

### Failover Automation

```typescript
// src/enterprise/dr/failover.ts

interface FailoverConfig {
  primaryRegion: string;
  drRegion: string;
  rpoTarget: number; // seconds
  rtoTarget: number; // seconds
  autoFailover: boolean; // Enterprise only
  healthCheckInterval: number; // seconds
}

async function checkPrimaryHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${PRIMARY_URL}/health`);
    return response.status === 200;
  } catch {
    return false;
  }
}

async function executeFailover(config: FailoverConfig): Promise<void> {
  // 1. Confirm primary is down (check 3 times, 10s apart)
  let failures = 0;
  for (let i = 0; i < 3; i++) {
    if (!await checkPrimaryHealth()) failures++;
    await sleep(10000);
  }
  if (failures < 3) return; // False alarm

  // 2. Promote standby database
  await exec(`pg_ctl promote -D /var/lib/postgresql/data`);

  // 3. Start Carina + Scout in DR region
  await exec(`docker compose up -d`, { workdir: DR_DEPLOY_DIR });

  // 4. Verify DR is healthy
  const drHealthy = await checkDRHealth();
  if (!drHealthy) throw new Error('DR failover failed');

  // 5. Update DNS to point to DR
  await updateDNS(config.drRegion);

  // 6. Notify operators
  await sendAlert({
    severity: 'critical',
    title: 'Failover executed',
    body: `Primary region ${config.primaryRegion} failed. DR region ${config.drRegion} is now active.`,
  });
}
```

### Backup Script

```bash
#!/bin/bash
# /opt/carina/scripts/backup.sh

BACKUP_DIR="/mnt/backups/carina"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# 1. PostgreSQL backup via pgBackRest
pgbackrest --stanza=carina --type=full backup

# 2. Config backup
tar -czf "$BACKUP_DIR/config-$TIMESTAMP.tar.gz" /etc/carina/

# 3. Upload to S3 with encryption
aws s3 cp "$BACKUP_DIR/config-$TIMESTAMP.tar.gz" \
  "s3://carina-backups/config/$TIMESTAMP.tar.gz" \
  --sse aws:kms --sse-kms-key-id "$KMS_KEY_ID"

# 4. Rotate old backups (keep 30 days)
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete
```

### Recovery Test

```bash
# Quarterly DR test script
# 1. Restore from latest backup
pgbackrest --stanza=carina --type=time --target="$TEST_TIMESTAMP" restore

# 2. Replay WAL to point-in-time
pgbackrest --stanza=carina --type=time --target=latest restore

# 3. Start Carina in DR
docker compose up -d

# 4. Verify data integrity
psql -c "SELECT count(*) FROM audit_events;"
psql -c "SELECT count(*) FROM findings;"
psql -c "SELECT max(created_at) FROM scan_runs;"

# 5. Verify API
curl -s https://dr.carinaai.uk/health | jq .status
# Expected: "ok"

# 6. Measure RTO
echo "RTO: $(($(date +%s) - START_TIME)) seconds"

# 7. Cleanup
docker compose down
```

### SLA Monitoring Dashboard

```
Settings → Enterprise → Disaster Recovery
  ┌──────────────────────────────────────────┐
  │ Disaster Recovery Status                  │
  │                                           │
  │ Primary:  ● eu-west-1 (Healthy)           │
  │ DR:       ○ us-east-1 (Standby)           │
  │                                           │
  │ Last Backup:    2 min ago                 │
  │ Last WAL Ship:  5 sec ago                 │
  │ RPO Actual:     5 min (Target: 5 min) Done:   │
  │ RTO Estimated:  12 min (Target: 15 min) Done: │
  │                                           │
  │ Last DR Test:   2026-06-01 (Passed)       │
  │ Next DR Test:   2026-09-01                │
  │                                           │
  │ [Run DR Test Now]  [Configure]            │
  └──────────────────────────────────────────┘
```

### Pitfalls
1. **DNS propagation**; TTL must be low (60s) for fast failover. Set before incident.
2. **Split brain**; Never have two primaries writing. Use fencing tokens.
3. **Test regularly**; Untested DR is not DR. Quarterly failover drills are mandatory.
4. **Cost**; Running a warm standby doubles infrastructure cost. Enterprise customers pay for it.
5. **Stateful services**; Redis, message queues need separate backup strategies.
