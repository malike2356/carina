# Prompt 02: Immutable Audit Log with Cryptographic Anchoring

## Context

Scout Govern tier requires an immutable audit trail. "Immutable" means: once written, an
audit entry cannot be modified or deleted. Cryptographic anchoring means: the existence
of each entry is provable even if someone gains DB access, because the hash chain is
recorded externally.

The implementation uses a Merkle chain in PostgreSQL with periodic anchoring to Ethereum
(same pattern as the SOC2 evidence packager in category 06).

## What to Build

### 1. Append-only audit table

```sql
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  tenant_id UUID REFERENCES organizations(id),
  user_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  prev_hash TEXT,     -- SHA-256 of the previous entry
  entry_hash TEXT,    -- SHA-256 of (prev_hash + this entry's fields)
  anchor_tx TEXT      -- Ethereum tx hash (set when anchored)
);

-- No DELETE or UPDATE permissions on this table
REVOKE DELETE ON audit_log FROM carina_app;
REVOKE UPDATE ON audit_log FROM carina_app;
```

The Postgres role `carina_app` has only INSERT + SELECT on `audit_log`. Deletes and updates
require `carina_admin` (used only for emergency recovery procedures, restricted to DB admin).

### 2. Audit writer

Create `src/security/audit/writer.ts`:
```typescript
export async function writeAuditEntry(entry: Omit<AuditEntry, 'id' | 'prevHash' | 'entryHash'>): Promise<void> {
  const lastEntry = await db.query(
    'SELECT entry_hash FROM audit_log ORDER BY id DESC LIMIT 1'
  );
  const prevHash = lastEntry.rows[0]?.entry_hash ?? '0'.repeat(64);

  const entryData = JSON.stringify({ ...entry, prevHash });
  const entryHash = sha256(entryData);

  await db.query(
    `INSERT INTO audit_log (timestamp, tenant_id, user_id, action, resource_type, resource_id, details, ip_address, user_agent, prev_hash, entry_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [entry.timestamp ?? new Date(), entry.tenantId, entry.userId, entry.action, entry.resourceType, entry.resourceId, entry.details, entry.ipAddress, entry.userAgent, prevHash, entryHash]
  );
}
```

### 3. Merkle chain verifier

Create `src/security/audit/verifier.ts`:
```typescript
export async function verifyChain(fromId: bigint, toId: bigint): Promise<ChainVerifyResult> {
  const entries = await db.query(
    'SELECT * FROM audit_log WHERE id BETWEEN $1 AND $2 ORDER BY id',
    [fromId, toId]
  );

  const violations: number[] = [];
  for (let i = 1; i < entries.rows.length; i++) {
    const expected = sha256(JSON.stringify({
      ...entries.rows[i],
      prevHash: entries.rows[i - 1].entry_hash,
    }));
    if (expected !== entries.rows[i].entry_hash) {
      violations.push(Number(entries.rows[i].id));
    }
  }

  return {
    totalEntries: entries.rows.length,
    violations,
    valid: violations.length === 0,
  };
}
```

### 4. Ethereum anchoring cron

Every 24 hours, anchor the latest entry's hash to Ethereum:
```typescript
export async function anchorLatestEntry(): Promise<void> {
  const latest = await db.query('SELECT id, entry_hash FROM audit_log ORDER BY id DESC LIMIT 1');
  if (!latest.rows[0]) return;

  const txHash = await anchorToEthereum(latest.rows[0].entry_hash);
  await db.query('UPDATE audit_log SET anchor_tx = $1 WHERE id = $2', [txHash, latest.rows[0].id]);
}
```

### 5. Audit coverage

Ensure ALL sensitive operations write to the audit log:
- Authentication events (login, logout, failed login)
- Permission changes (role assignment)
- Tool executions (especially redteam and forensics tools)
- Data access (memory reads, document downloads)
- Config changes (env var updates, org settings)
- Session events (start, end, export)

## Verification Checklist

- [ ] `verifyChain(1n, 1000n)` returns `{ valid: true }` for normal operations
- [ ] Manually update a hash in DB, run verifier - reports violation at that entry ID
- [ ] `DELETE FROM audit_log WHERE id = 1` fails with permission denied error
- [ ] Ethereum anchor is written every 24 hours (anchor_tx column populated)
- [ ] All authentication events appear in audit_log

## Files to Create or Modify

- MODIFY `docker/postgres/init.sql` - create audit_log table with permission restrictions
- CREATE `src/security/audit/writer.ts`
- CREATE `src/security/audit/verifier.ts`
- CREATE `src/security/audit/anchor-cron.ts`
- MODIFY `src/api/auth.ts` - call writeAuditEntry on login/logout
- MODIFY `src/agents/CarinaAgent.ts` - call writeAuditEntry on tool execution
