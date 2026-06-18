# Prompt 03: Data Residency & Geo-Fencing

**Gap:** 08; Enterprise Security | **Priority:** HIGH | **Build Time:** 1 week

---

## GOAL

Enterprises subject to GDPR, CCPA, Schrems II, or local data sovereignty laws must be able to specify which geographic regions their data is stored and processed in. Carina must support region-locked data storage and processing with verifiable compliance.

## SPECIFICATION

### Data Classification

| Data Tier | Examples | Residency Rule |
|-----------|----------|---------------|
| P0; Secrets | API keys, tokens, passwords | Encrypted at rest, never leaves region |
| P1; Customer Data | Chat history, investigation notes, findings | Stored in specified region only |
| P2; Operational Data | Metrics, logs, health checks | Can be global, anonymized |
| P3; Public Data | Skill hub content, documentation | No restrictions |

### Configuration

```bash
# Region configuration
DATA_RESIDENCY_REGION=eu-west        # aws|gcp|azure region code
DATA_RESIDENCY_MODE=strict           # strict|permissive
DATA_RESIDENCY_ENCRYPTION=aws-kms    # aws-kms|gcp-kms|azure-keyvault

# Storage backends per tier
STORAGE_P0_BACKEND=postgres+aws-kms
STORAGE_P1_BACKEND=s3+eu-west-1
STORAGE_P2_BACKEND=s3+global
```

### Enforcement

```typescript
// src/enterprise/data-residency.ts

const REGION_STORAGE_MAP: Record<string, StorageConfig> = {
  'eu-west': {
    postgres: { host: 'carina-db.eu-west-1.rds.amazonaws.com', region: 'eu-west-1' },
    s3: { bucket: 'carina-data-eu-west-1', region: 'eu-west-1' },
    kms: { keyId: 'arn:aws:kms:eu-west-1:...', region: 'eu-west-1' },
  },
  'us-east': {
    postgres: { host: 'carina-db.us-east-1.rds.amazonaws.com', region: 'us-east-1' },
    s3: { bucket: 'carina-data-us-east-1', region: 'us-east-1' },
    kms: { keyId: 'arn:aws:kms:us-east-1:...', region: 'us-east-1' },
  },
  'ap-southeast': {
    postgres: { host: 'carina-db.ap-southeast-1.rds.amazonaws.com', region: 'ap-southeast-1' },
    s3: { bucket: 'carina-data-ap-southeast-1', region: 'ap-southeast-1' },
    kms: { keyId: 'arn:aws:kms:ap-southeast-1:...', region: 'ap-southeast-1' },
  },
};

async function validateStorageLocation(data: any, tier: string): Promise<boolean> {
  const region = getConfig('DATA_RESIDENCY_REGION');
  const storage = REGION_STORAGE_MAP[region];
  if (!storage) throw new Error(`Unknown region: ${region}`);

  // Verify data is written to correct region
  const actualRegion = await getActualStorageRegion(data);
  return actualRegion === storage.s3.region;
}

async function getActualStorageRegion(data: any): Promise<string> {
  // Query S3/Postgres for object's physical location
  // Returns region code
}
```

### Geo-Fencing API Requests

```typescript
// Middleware that blocks requests from disallowed regions
async function geoFenceMiddleware(req: Request, res: Response, next: NextFunction) {
  const region = getConfig('DATA_RESIDENCY_REGION');
  if (getConfig('DATA_RESIDENCY_MODE') !== 'strict') return next();

  const clientRegion = await geoIP(req.ip);
  // Allow EU-bound traffic from anywhere
  // Block non-EU data access if data is in EU
  if (region.startsWith('eu') && !EU_COUNTRIES.includes(clientRegion)) {
    // Only block data-access endpoints, not auth/public
    if (req.path.startsWith('/api/v1/data/')) {
      return res.status(451).json({ error: 'Data not available in your region' });
    }
  }
  next();
}
```

### Compliance Dashboard

```
Settings → Enterprise → Data Residency
  ┌──────────────────────────────────────┐
  │ Data Residency: ● EU-West (Ireland)  │
  │ Mode: Strict                         │
  │                                      │
  │ Storage:                             │
  │   PostgreSQL: eu-west-1 Done:            │
  │   S3:         eu-west-1 Done:            │
  │   KMS:        eu-west-1 Done:            │
  │                                      │
  │ Compliance Checks (last 24h):        │
  │   Cross-region writes:    0          │
  │   Unauthorized access:    0          │
  │   Policy violations:      0          │
  │                                      │
  │ [Export Compliance Report]           │
  └──────────────────────────────────────┘
```

### Pitfalls
1. **Cross-region latency**; DB in Ireland, user in Singapore = 200ms. Cache aggressively.
2. **Backup regions**; DR backups may cross regions. Document and get customer approval.
3. **Vendor lock-in**; AWS/GCP/Azure region codes differ. Abstract the storage layer.
4. **China data laws**; Separate from GDPR. Requires in-country storage + government-approved encryption.

Verify: `curl https://carinaai.uk/api/v1/admin/data-residency | jq .region`
