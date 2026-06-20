# Scout 02; Score Engine: Real Scoring with Trends

**Gap:** 12; Scout Product
**Agent:** Claude Code (primary), Cursor (fallback)
**Effort:** 3 days

---

## Context

The Scout Score is the single number every CISO wants. "Am I getting better or worse?" The score must be real; calculated from live findings, weighted by severity, trended over time. This prompt builds the scoring engine.

---

## Module 1: Score Calculation

**File:** `scout-engine/src/scoring/scout-score.ts`

```typescript
// scout-engine/src/scoring/scout-score.ts

import { db } from '../db/index.js';

interface ScoreBreakdown {
  total: number; // 0-100
  categories: {
    exposure: number; // Open ports, services (0-100)
    vulnerabilities: number; // CVEs, vuln findings (0-100)
    compliance: number; // SOC2 controls covered (0-100)
    agentSafety: number; // Agent monitoring safety (0-100)
  };
  weights: {
    exposure: number; // Default: 0.25
    vulnerabilities: number; // Default: 0.35
    compliance: number; // Default: 0.25
    agentSafety: number; // Default: 0.15
  };
  trend: {
    direction: 'up' | 'down' | 'stable';
    change: number; // Points changed since last period
    previousScore: number;
  };
  findingCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  calculatedAt: string;
}

export async function calculateScoutScore(workspaceId: string): Promise<ScoreBreakdown> {
  // 1. Exposure Score: penalized by open ports and exposed services
  const exposureScore = await calculateExposureScore(workspaceId);

  // 2. Vulnerability Score: penalized by CVEs and vuln findings
  const vulnScore = await calculateVulnerabilityScore(workspaceId);

  // 3. Compliance Score: percentage of SOC2 controls with evidence
  const complianceScore = await calculateComplianceScore(workspaceId);

  // 4. Agent Safety Score: penalized by suspicious agent activity
  const agentSafetyScore = await calculateAgentSafetyScore(workspaceId);

  // Weighted total
  const weights = { exposure: 0.25, vulnerabilities: 0.35, compliance: 0.25, agentSafety: 0.15 };
  const total = Math.round(
    exposureScore * weights.exposure +
    vulnScore * weights.vulnerabilities +
    complianceScore * weights.compliance +
    agentSafetyScore * weights.agentSafety
  );

  // Trend
  const trend = await calculateTrend(workspaceId, total);

  // Finding counts
  const findingCounts = await getFindingCounts(workspaceId);

  return {
    total: Math.max(0, Math.min(100, total)),
    categories: {
      exposure: exposureScore,
      vulnerabilities: vulnScore,
      compliance: complianceScore,
      agentSafety: agentSafetyScore,
    },
    weights,
    trend,
    findingCounts,
    calculatedAt: new Date().toISOString(),
  };
}

async function calculateExposureScore(workspaceId: string): Promise<number> {
  const findings = await db('findings')
    .where({ workspace_id: workspaceId, status: 'open' })
    .whereIn('finding_type', ['open_port', 'service', 'subdomain', 'exposed_secret'])
    .where('last_seen_at', '>=', db.raw("NOW() - INTERVAL '30 days'"));

  // Penalty per finding by severity
  const penalties = {
    critical: 15,
    high: 8,
    medium: 4,
    low: 2,
    info: 0.5,
  };

  let penalty = 0;
  for (const f of findings) {
    penalty += penalties[f.severity as keyof typeof penalties] || 0;
  }

  return Math.max(0, 100 - penalty);
}

async function calculateVulnerabilityScore(workspaceId: string): Promise<number> {
  const findings = await db('findings')
    .where({ workspace_id: workspaceId, status: 'open' })
    .whereIn('finding_type', ['vulnerability', 'cve', 'misconfiguration', 'certificate_issue'])
    .where('last_seen_at', '>=', db.raw("NOW() - INTERVAL '30 days'"));

  let penalty = 0;
  for (const f of findings) {
    // CVSS-based penalty for CVEs
    if (f.cvss_score) {
      if (f.cvss_score >= 9.0) penalty += 20;
      else if (f.cvss_score >= 7.0) penalty += 12;
      else if (f.cvss_score >= 4.0) penalty += 6;
      else penalty += 3;
    } else {
      // Severity-based penalty
      const sevPenalties = { critical: 15, high: 8, medium: 4, low: 2, info: 1 };
      penalty += sevPenalties[f.severity as keyof typeof sevPenalties] || 0;
    }
  }

  return Math.max(0, 100 - penalty);
}

async function calculateComplianceScore(workspaceId: string): Promise<number> {
  // Delegate to compliance scoring (same as SOC visibility spec)
  const result = await db('compliance_evidence')
    .where('workspace_id', workspaceId)
    .where('collected_at', '>=', db.raw("NOW() - INTERVAL '12 months'"))
    .countDistinct('control_id as count')
    .first();

  const covered = parseInt(result?.count as string || '0');
  return Math.round((covered / 14) * 100);
}

async function calculateAgentSafetyScore(workspaceId: string): Promise<number> {
  const suspiciousCount = await db('findings')
    .where({ workspace_id: workspaceId, status: 'open' })
    .whereIn('finding_type', ['suspicious_activity', 'intrusion_alert'])
    .where('last_seen_at', '>=', db.raw("NOW() - INTERVAL '7 days'"))
    .count('* as count')
    .first();

  const count = parseInt(suspiciousCount?.count as string || '0');
  return Math.max(0, 100 - count * 10);
}

async function calculateTrend(workspaceId: string, currentScore: number): Promise<ScoreBreakdown['trend']> {
  // Compare to score from 7 days ago
  const previousScore = await db('scout_scores')
    .where({ workspace_id: workspaceId })
    .where('calculated_at', '<=', db.raw("NOW() - INTERVAL '7 days'"))
    .orderBy('calculated_at', 'desc')
    .first();

  const prev = previousScore?.total || currentScore;
  const change = currentScore - prev;

  return {
    direction: change > 1 ? 'up' : change < -1 ? 'down' : 'stable',
    change: Math.round(change),
    previousScore: prev,
  };
}

async function getFindingCounts(workspaceId: string): Promise<ScoreBreakdown['findingCounts']> {
  const rows = await db('findings')
    .where({ workspace_id: workspaceId, status: 'open' })
    .where('last_seen_at', '>=', db.raw("NOW() - INTERVAL '30 days'"))
    .select('severity')
    .count('* as count')
    .groupBy('severity');

  const counts: any = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const row of rows) {
    counts[row.severity] = parseInt(row.count as string);
  }
  return counts;
}
```

### Score History Table

**File:** `scout-engine/src/db/migrations/002-scout-scores.sql`

```sql
CREATE TABLE IF NOT EXISTS scout_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  total INTEGER NOT NULL,
  categories JSONB NOT NULL,       -- { exposure, vulnerabilities, compliance, agentSafety }
  weights JSONB NOT NULL,
  finding_counts JSONB NOT NULL,
  calculated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scores_workspace ON scout_scores(workspace_id, calculated_at DESC);

-- Score change alerts: notify when score drops significantly
CREATE TABLE IF NOT EXISTS score_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  previous_score INTEGER NOT NULL,
  current_score INTEGER NOT NULL,
  change INTEGER NOT NULL,
  reason TEXT,                     -- "3 new critical CVEs", "5 high findings resolved"
  notified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Score Calculation Job

**File:** `scout-engine/src/scoring/score-job.ts`

```typescript
// Run every hour for all active workspaces
cron.schedule('0 * * * *', async () => {
  const workspaces = await db('workspaces').where({ active: true });

  for (const ws of workspaces) {
    const score = await calculateScoutScore(ws.id);

    // Store score
    await db('scout_scores').insert({
      workspace_id: ws.id,
      total: score.total,
      categories: JSON.stringify(score.categories),
      weights: JSON.stringify(score.weights),
      finding_counts: JSON.stringify(score.findingCounts),
    });

    // Check for significant drops (>5 points)
    if (score.trend.direction === 'down' && Math.abs(score.trend.change) >= 5) {
      await db('score_alerts').insert({
        workspace_id: ws.id,
        previous_score: score.trend.previousScore,
        current_score: score.total,
        change: score.trend.change,
        reason: await generateScoreDropReason(ws.id, score),
      });
    }
  }
});
```

---

## Module 2: API Endpoint

**File:** `scout-engine/src/api/scoring.ts`

```typescript
// GET /api/v1/scout-score?workspace_id=X
// Returns current score + trend + breakdown

router.get('/scout-score', auth, async (req, res) => {
  const workspaceId = req.query.workspace_id as string;
  const score = await calculateScoutScore(workspaceId);

  res.json({
    score: score.total,
    breakdown: score.categories,
    trend: score.trend,
    findingCounts: score.findingCounts,
    calculatedAt: score.calculatedAt,
  });
});

// GET /api/v1/scout-score/history?workspace_id=X&days=90
// Returns score history for trend chart

router.get('/scout-score/history', auth, async (req, res) => {
  const days = parseInt(req.query.days as string) || 90;
  const scores = await db('scout_scores')
    .where({ workspace_id: req.query.workspace_id })
    .where('calculated_at', '>=', db.raw(`NOW() - INTERVAL '${days} days'`))
    .orderBy('calculated_at', 'asc');

  res.json(scores.map(s => ({
    score: s.total,
    categories: s.categories,
    date: s.calculated_at,
  })));
});
```

---

## Files Summary

```
scout-engine/src/
  scoring/
    scout-score.ts               CREATE (calculation engine)
    score-job.ts                  CREATE (hourly score calculation cron)
  db/migrations/
    002-scout-scores.sql          CREATE (scout_scores + score_alerts tables)
  api/
    scoring.ts                    CREATE (GET /scout-score, GET /scout-score/history)
```

## Done-When Criteria

- [ ] `calculateScoutScore()` returns a real 0-100 score from live findings
- [ ] Exposure score drops when open ports/exposed services exist
- [ ] Vulnerability score drops proportionally to CVSS severity
- [ ] Score history is recorded every hour
- [ ] Trend shows direction + point change compared to 7 days ago
- [ ] Score drops of 5+ points generate a score_alert with reason
- [ ] `GET /api/v1/scout-score` returns current score + breakdown
- [ ] `GET /api/v1/scout-score/history?days=30` returns time-series data
