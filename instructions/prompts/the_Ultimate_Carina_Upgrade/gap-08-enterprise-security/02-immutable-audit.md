# Prompt 02: Immutable Audit & Cryptographic Proof

**Gap:** 08; Enterprise Security
**Priority:** CRITICAL
**Build Time:** 1 week
**Depends On:** gap-01 (Docker)

---

## GOAL

Every action in Carina; every tool invocation, every approval, every configuration change, every session start and end; must be logged to an immutable audit trail with cryptographic proof that it has not been tampered with. Enterprises require this for SOC2, ISO27001, and regulatory compliance.

## ARCHITECTURE

```
┌─────────────────────────────────────────────────────────┐
│                  Audit Layer                              │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Agent    │  │ Scout    │  │ Admin    │              │
│  │ Actions  │  │ Alerts   │  │ Changes  │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │              │              │                    │
│       ▼              ▼              ▼                    │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Audit Event Collector                 │   │
│  │  • Normalizes all events to AuditEvent schema      │   │
│  │  • Assigns sequential event ID                     │   │
│  │  • Timestamps with NTP-synced clock                │   │
│  └──────────────────────┬───────────────────────────┘   │
│                         │                                │
│                         ▼                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Merkle Tree Builder                  │   │
│  │  • Every N events → new leaf node                 │   │
│  │  • Leaf hash = SHA-256(event JSON)                │   │
│  │  • Tree root published hourly                     │   │
│  └──────────────────────┬───────────────────────────┘   │
│                         │                                │
│                         ▼                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │              WORM Storage                          │   │
│  │  • Primary: PostgreSQL (immutable table)           │   │
│  │  • Secondary: S3-compatible object store           │   │
│  │  • Tertiary: Optional blockchain anchoring         │   │
│  └──────────────────────┬───────────────────────────┘   │
│                         │                                │
│                         ▼                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Verification API                      │   │
│  │  • GET /audit/verify/:eventId → Merkle proof      │   │
│  │  • GET /audit/tree/:hour → Root hash              │   │
│  │  • POST /audit/verify-range → Batch verification  │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## TYPE SCRIPT IMPLEMENTATION

```typescript
// src/audit/audit-event.ts

interface AuditEvent {
  id: string; // UUIDv7 (time-ordered)
  sequence: number; // Monotonically increasing
  timestamp: string; // ISO 8601 with microseconds
  actor: {
    type: 'user' | 'agent' | 'system' | 'scout';
    id: string; // User ID, agent session ID, or 'system'
    name: string;
    ip?: string;
    sessionId?: string;
  };
  action: {
    category: 'tool' | 'config' | 'auth' | 'session' | 'approval' | 'system';
    name: string; // e.g., 'nmap_scan', 'config.update', 'login'
    target?: string; // e.g., target IP, config key
    parameters?: Record<string, unknown>; // Sanitized (no secrets)
  };
  outcome: {
    status: 'success' | 'failure' | 'denied' | 'timeout';
    errorCode?: string;
    errorMessage?: string;
  };
  metadata: {
    version: number; // Schema version
    source: string; // 'carina-core' | 'scout' | 'admin-api'
    tags: string[];
  };
}

// src/audit/merkle-tree.ts

import { createHash } from 'crypto';

class MerkleTree {
  private leaves: string[] = [];
  private events: AuditEvent[] = [];

  addEvent(event: AuditEvent): void {
    this.events.push(event);
    const hash = this.hashEvent(event);
    this.leaves.push(hash);
  }

  private hashEvent(event: AuditEvent): string {
    const canonical = JSON.stringify(event, Object.keys(event).sort());
    return createHash('sha256').update(canonical).digest('hex');
  }

  buildTree(): MerkleNode {
    if (this.leaves.length === 0) throw new Error('Empty tree');
    let level = this.leaves.map(h => ({ hash: h, left: null, right: null } as MerkleNode));

    while (level.length > 1) {
      const nextLevel: MerkleNode[] = [];
      for (let i = 0; i < level.length; i += 2) {
        if (i + 1 < level.length) {
          const combined = level[i].hash + level[i+1].hash;
          nextLevel.push({
            hash: createHash('sha256').update(combined).digest('hex'),
            left: level[i],
            right: level[i+1],
          });
        } else {
          nextLevel.push(level[i]); // Odd node promoted
        }
      }
      level = nextLevel;
    }
    return level[0]; // Root
  }

  getProof(eventIndex: number): MerkleProof {
    // Generate Merkle proof for a specific event
    // Returns sibling hashes needed to reconstruct root
    const proof: MerkleProof = {
      eventIndex,
      eventHash: this.leaves[eventIndex],
      siblings: [],
      rootHash: '',
    };
    // ... Merkle proof generation logic
    return proof;
  }
}

interface MerkleNode {
  hash: string;
  left: MerkleNode | null;
  right: MerkleNode | null;
}

interface MerkleProof {
  eventIndex: number;
  eventHash: string;
  siblings: string[];
  rootHash: string;
}
```

## WORM STORAGE

```sql
-- Immutable audit table
CREATE TABLE audit_events (
  id UUID PRIMARY KEY,
  sequence BIGSERIAL UNIQUE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_json JSONB NOT NULL,
  event_hash CHAR(64) NOT NULL,        -- SHA-256 of canonical JSON
  merkle_root CHAR(64),                -- Root hash at time of insertion
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Prevent UPDATE and DELETE
CREATE RULE audit_events_no_update AS ON UPDATE TO audit_events
  DO INSTEAD NOTHING;

CREATE RULE audit_events_no_delete AS ON DELETE TO audit_events
  DO INSTEAD NOTHING;

-- Merkle roots table (one per hour)
CREATE TABLE merkle_roots (
  hour TIMESTAMPTZ PRIMARY KEY,        -- Truncated to hour
  root_hash CHAR(64) NOT NULL,
  event_count INTEGER NOT NULL,
  first_sequence BIGINT NOT NULL,
  last_sequence BIGINT NOT NULL,
  published_at TIMESTAMPTZ DEFAULT now()
);

-- Secondary WORM storage (S3)
CREATE TABLE audit_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hour TIMESTAMPTZ NOT NULL,
  format TEXT NOT NULL DEFAULT 'jsonl', -- 'jsonl' | 'parquet'
  storage_path TEXT NOT NULL,           -- s3://carina-audit/2026/06/17/14.jsonl
  size_bytes BIGINT,
  sha256 CHAR(64),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## BLOCKCHAIN ANCHORING (Optional)

```typescript
// src/audit/blockchain-anchor.ts

interface BlockchainAnchor {
  transaction: 'ethereum' | 'bitcoin' | 'solana';
  rpcUrl: string;
  contractAddress?: string; // For Ethereum
  publishInterval: 'hourly' | 'daily';
}

async function anchorMerkleRoot(rootHash: string, config: BlockchainAnchor): Promise<void> {
  // 1. Build transaction payload: OP_RETURN with root hash
  // 2. Submit to blockchain
  // 3. Store transaction ID for verification
  // Cost: ~$0.05 per anchor (Ethereum L2) to ~$2 (Bitcoin)
  // This proves the audit trail existed at a specific point in time
}
```

## VERIFICATION API

```
# Verify a single event
GET /api/v1/audit/verify/evt_abc123
→ {
    "event": { ... },
    "verified": true,
    "merkle_proof": {
      "siblings": ["abc...", "def..."],
      "root_hash": "123...",
      "root_published_at": "2026-06-17T14:00:00Z",
      "blockchain_tx": "0x..."  // if anchored
    }
  }

# Verify a range of events
POST /api/v1/audit/verify-range
Body: { "from_sequence": 1000, "to_sequence": 1100 }
→ { "verified": true, "events_checked": 100, "roots_matched": 2 }

# Export for auditors
GET /api/v1/audit/export?from=2026-06-01&to=2026-06-17&format=jsonl
→ Downloadable audit package with Merkle proofs
```

## RETENTION POLICY

```typescript
const AUDIT_RETENTION = {
  hot: '90 days',       // PostgreSQL; fast queries
  warm: '7 years',      // S3; compressed, indexed
  cold: '10 years',     // Glacier; compliance minimum
  merkleRoots: 'forever', // Tiny data, permanent
};
```

## PITFALLS

1. **Sequence gaps**; If a transaction fails after incrementing sequence, there's a gap. Use sequence allocation at commit time, not event creation.
2. **Clock skew**; Timestamps must be NTP-synced. Use database `now()` not application time.
3. **Performance**; Merkle tree rebuild on every event is expensive. Batch every 1000 events or 60 seconds.
4. **Key management**; If using blockchain anchoring, the signing key must be in HSM. Losing it means losing anchor ability.
5. **Storage growth**; 1000 events/day × 1KB = 365MB/year. Manageable. With 10K events/day = 3.6GB/year. Plan for it.
6. **Export format**; Auditors expect JSON Lines or Parquet, not custom formats.

## VERIFICATION

```bash
# Create test events
curl -X POST https://carinaai.uk/api/v1/admin/audit/test \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"count": 100}'

# Verify an event
curl https://carinaai.uk/api/v1/audit/verify/evt_test001

# Check hourly root
curl https://carinaai.uk/api/v1/audit/tree/2026-06-17T14:00:00Z

# Attempt tamper detection
# (Try to modify event in DB; should fail due to RULE)
psql -c "UPDATE audit_events SET event_json = '{}' WHERE id = 'evt_test001'"
# → ERROR: rule audit_events_no_update prevents UPDATE
```
