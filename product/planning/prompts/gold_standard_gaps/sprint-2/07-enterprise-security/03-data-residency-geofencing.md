# Prompt 03: Data Residency and Geofencing

## Context

Enterprise customers in regulated industries (healthcare, finance, government) require data
to stay within specific geographic regions. Geofencing adds access controls that block
users from regions outside their organization's permitted zones.

This is a Scout Govern tier feature.

## What to Build

### 1. Organization region config

Add to the `organizations` table:
```sql
ALTER TABLE organizations ADD COLUMN
  data_residency_region TEXT,  -- 'eu', 'us', 'uk', 'au', or null (no restriction)
  allowed_access_regions TEXT[],  -- regions allowed to access this org's data
  geo_block_enabled BOOLEAN DEFAULT false;
```

Example config:
```json
{
  "dataResidencyRegion": "eu",
  "allowedAccessRegions": ["eu", "uk"],
  "geoBlockEnabled": true
}
```

### 2. Region detection middleware

Create `src/security/geofencing/region-detector.ts`:
```typescript
import { lookup } from 'geoip-lite';

export type Region = 'eu' | 'us' | 'uk' | 'au' | 'asia' | 'other';

const EU_COUNTRY_CODES = ['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'PL', 'SE', 'NO', 'DK', 'FI', 'AT', 'CH', 'PT', 'IE', 'GR', 'CZ', 'HU', 'RO', 'BG', 'HR', 'SK', 'SI'];

export function detectRegion(ip: string): Region {
  const geo = lookup(ip);
  if (!geo) return 'other';
  if (geo.country === 'GB') return 'uk';
  if (geo.country === 'US') return 'us';
  if (geo.country === 'AU' || geo.country === 'NZ') return 'au';
  if (EU_COUNTRY_CODES.includes(geo.country)) return 'eu';
  return 'other';
}
```

Add `geoip-lite` as dependency: `pnpm add geoip-lite`

### 3. Geofence middleware

Create `src/security/geofencing/middleware.ts`:
```typescript
import { Request, Response, NextFunction } from 'express';

export function geofenceMiddleware(req: Request, res: Response, next: NextFunction): void {
  const org = req.session?.org;
  if (!org?.geoBlockEnabled) { next(); return; }

  const ip = req.ip ?? req.socket.remoteAddress ?? '';
  const region = detectRegion(ip);

  if (!org.allowedAccessRegions.includes(region)) {
    res.status(403).json({
      error: 'Access denied',
      reason: `Access from region ${region} is not permitted for this organization`,
    });
    writeAuditEntry({
      action: 'geofence.blocked',
      details: { ip, region, allowedRegions: org.allowedAccessRegions },
    });
    return;
  }
  next();
}
```

Apply after session auth middleware: `app.use('/api', authMiddleware, geofenceMiddleware);`

### 4. Data residency for PostgreSQL data

Data residency enforcement at the application level means Carina only writes to the
database instance configured for the org's region. In a multi-region setup:
- EU org data: writes to `DATABASE_URL_EU` (Frankfurt or Dublin)
- US org data: writes to `DATABASE_URL_US` (Virginia or Ohio)
- UK org data: writes to `DATABASE_URL_UK` (London)

Create `src/memory/regional-db.ts`:
```typescript
import { Pool } from 'pg';

const pools: Record<string, Pool> = {
  eu: new Pool({ connectionString: process.env.DATABASE_URL_EU }),
  us: new Pool({ connectionString: process.env.DATABASE_URL_US }),
  uk: new Pool({ connectionString: process.env.DATABASE_URL_UK }),
  default: new Pool({ connectionString: process.env.DATABASE_URL }),
};

export function getPool(region?: string): Pool {
  return pools[region ?? 'default'] ?? pools['default'];
}
```

### 5. Admin controls

In the ops admin panel, add a "Data Residency" section under org settings:
- Region picker (EU / US / UK / AU / None)
- Allowed access regions multi-select
- Geo-block toggle
- "View geo-blocked access attempts" log link

## Verification Checklist

- [ ] Configure org for EU region with geo-block enabled
- [ ] Request from US IP returns 403 with region error
- [ ] Request from German IP (EU) proceeds normally
- [ ] Geo-block event appears in audit log
- [ ] `detectRegion('8.8.8.8')` returns 'us', `detectRegion('195.148.127.1')` returns 'eu'

## Files to Create or Modify

- MODIFY `docker/postgres/init.sql` - add columns to organizations table
- CREATE `src/security/geofencing/region-detector.ts`
- CREATE `src/security/geofencing/middleware.ts`
- CREATE `src/memory/regional-db.ts`
- MODIFY `src/server.ts` - apply geofence middleware
- MODIFY `ops.carinaai.uk/views/org-settings.ejs` - add data residency section
- MODIFY `package.json` - add geoip-lite
