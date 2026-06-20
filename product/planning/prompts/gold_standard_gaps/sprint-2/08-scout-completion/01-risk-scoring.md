# Prompt 01: Complete Risk Scoring Algorithm

## Context

Scout currently emits events and stores them. The "Scout Score" exists as a concept but
the algorithm for computing it is not fully implemented. This prompt builds the scoring
engine: CVSS-based event weighting + asset value weighting + trend tracking.

## What to Build

### 1. Scoring model

The Scout Score (0-100, higher = safer) is computed from:

```
Score = 100 - Sum(event_impact × recency_decay × asset_weight)
Clamped to [0, 100]
```

**Event impact:** Based on severity:
- critical: 20 points
- high: 10 points
- medium: 4 points
- low: 1 point

**Recency decay:** Events decay over time:
```
decay = exp(-age_days / 30)  // half-life 30 days
```

So a critical event from 30 days ago has impact `20 × exp(-1) ≈ 7.4`.
Events older than 90 days have negligible impact.

**Asset weight:** Events on high-value assets count more:
- production database: weight 2.0
- internet-facing web server: weight 1.5
- internal service: weight 1.0
- dev/test system: weight 0.5

### 2. Score calculator

Create `console.labyrinthscout.com/src/scoring/calculator.ts`:
```typescript
export async function computeScoutScore(tenantId: string): Promise<number> {
  const events = await db.query(
    `SELECT severity, timestamp, target_asset
     FROM events
     WHERE tenant_id = $1 AND timestamp > NOW() - INTERVAL '90 days'
     AND resolved = false`,
    [tenantId]
  );

  let totalImpact = 0;
  for (const event of events.rows) {
    const impact = SEVERITY_IMPACT[event.severity] ?? 0;
    const ageDays = (Date.now() - new Date(event.timestamp).getTime()) / 86400000;
    const decay = Math.exp(-ageDays / 30);
    const assetWeight = await getAssetWeight(event.target_asset);
    totalImpact += impact * decay * assetWeight;
  }

  return Math.max(0, Math.round(100 - totalImpact));
}

const SEVERITY_IMPACT: Record<string, number> = {
  critical: 20,
  high: 10,
  medium: 4,
  low: 1,
};
```

### 3. Score history

Store scores in a time series for trend tracking:
```sql
CREATE TABLE scout_scores (
  tenant_id UUID NOT NULL,
  score INTEGER NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_count INTEGER,
  critical_count INTEGER,
  high_count INTEGER
);
CREATE INDEX ON scout_scores (tenant_id, computed_at DESC);
```

Compute and store score every hour via a cron job in supervisord.

### 4. Score API

```
GET /api/score                     - current score (cached, max 5 min old)
GET /api/score/history?days=30     - daily scores for trending
GET /api/score/breakdown           - score broken down by severity and asset
```

Response format:
```json
{
  "score": 87,
  "trend": "up",
  "delta": 2,
  "breakdown": {
    "critical": 0,
    "high": 2,
    "medium": 5,
    "low": 12
  },
  "topRisks": [
    { "event": "CVE-2026-1844", "impact": 8.4, "asset": "nginx:8443" }
  ]
}
```

### 5. Asset registry

Create `console.labyrinthscout.com/src/assets/registry.ts`:
```typescript
// Operators register their assets with value weights
type Asset = {
  identifier: string; // IP, hostname, or FQDN
  name: string;
  type: 'production-db' | 'web-server' | 'internal-service' | 'dev';
  weight: number; // computed from type: 2.0, 1.5, 1.0, 0.5
};
```

Assets are registered via the Scout dashboard or imported from nmap scan results.

## Verification Checklist

- [ ] `GET /api/score` returns a score between 0 and 100
- [ ] Score decreases when a critical event is added
- [ ] Score recovers slowly as events age (30-day half-life)
- [ ] Production DB asset gives 2x weight to events against it vs dev system
- [ ] `GET /api/score/history?days=30` returns 30 data points for trending

## Files to Create or Modify

- CREATE `console.labyrinthscout.com/src/scoring/calculator.ts`
- MODIFY `console.labyrinthscout.com/src/server.ts` - add score API routes
- MODIFY `console.labyrinthscout.com/src/server.ts` - add hourly score cron
- CREATE `console.labyrinthscout.com/src/assets/registry.ts`
- MODIFY `console.labyrinthscout.com/public/dashboard.html` - show live score
