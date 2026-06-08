# Prompt 09 - Anomaly Detector

Build the anomaly detection system for Labyrinth Scout. It learns a statistical baseline of normal
agent behaviour from 7 days of historical security events, then flags sessions whose metrics deviate
significantly (Z-score based) in real time.

**Stack:** Node.js 22, TypeScript 5, Express 5, PostgreSQL 16, Redis 7. No PHP.

**Repo root:** `/opt/lampp/htdocs/VERLOX/Carina-ai/`

**Scout lives at:** `labyrinthscout/src/`

**Carina lives at:** `src/`

---

## Files to create or modify

### 1. `labyrinthscout/src/db/migrations.ts` (modify existing file)

Add two new tables to the existing `runMigrations()` function. Both use `IF NOT EXISTS` so they are
safe to re-run on every startup.

```sql
CREATE TABLE IF NOT EXISTS anomaly_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  mean_value FLOAT NOT NULL,
  std_dev FLOAT NOT NULL,
  sample_count INTEGER NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(instance_id, metric_name)
);

CREATE TABLE IF NOT EXISTS anomaly_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  current_value FLOAT NOT NULL,
  baseline_mean FLOAT NOT NULL,
  z_score FLOAT NOT NULL,
  is_anomaly BOOLEAN NOT NULL,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anomaly_scores_instance_time
  ON anomaly_scores (instance_id, detected_at DESC);
```

---

### 2. `labyrinthscout/src/security/anomaly-detector.ts` (new file)

#### Types

```typescript
export interface SessionMetrics {
  tool_calls_per_5min: number;
  unique_tools_used: number;
  avg_response_length: number;
  shell_exec_count: number;
  http_request_count: number;
  injection_attempt_count: number;
  egress_blocked_count: number;
}

export interface AnomalyResult {
  metricName: keyof SessionMetrics;
  currentValue: number;
  baselineMean: number;
  zScore: number;
  isCritical: boolean; // z > 5.0
}

interface BaselineRow {
  metric_name: string;
  mean_value: number;
  std_dev: number;
  sample_count: number;
}
```

#### Constants

```typescript
const Z_ANOMALY_THRESHOLD = 3.0;
const Z_CRITICAL_THRESHOLD = 5.0;
const METRIC_NAMES: (keyof SessionMetrics)[] = [
  'tool_calls_per_5min',
  'unique_tools_used',
  'avg_response_length',
  'shell_exec_count',
  'http_request_count',
  'injection_attempt_count',
  'egress_blocked_count',
];
// In-memory cache: key is `${instanceId}:${metricName}`, value is BaselineRow + expiry timestamp
const baselineCache = new Map<string, { row: BaselineRow; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
```

#### `BaselineLearner` class

```typescript
export class BaselineLearner {
  constructor(private readonly pool: Pool) {}

  async computeBaselines(instanceId: string): Promise<void> {
    // Query security_events for the past 7 days filtered by instance_id.
    // For each METRIC_NAME, extract values from the event metadata/description
    // field (stored as JSON string in the description column).
    //
    // The event rows relevant to baselines have event_type = 'session_metrics'
    // and description is a JSON string matching SessionMetrics.
    //
    // SQL to fetch raw rows:
    //   SELECT description FROM security_events
    //   WHERE instance_id = $1
    //     AND event_type = 'session_metrics'
    //     AND created_at > NOW() - INTERVAL '7 days'
    //
    // Parse each description as JSON. For each metric_name, collect the array
    // of numeric values. Compute mean and std_dev using the population formula:
    //   mean = sum(values) / n
    //   variance = sum((x - mean)^2) / n
    //   std_dev = sqrt(variance)
    //
    // If fewer than 10 samples exist for a metric, skip it (not enough data).
    //
    // Upsert into anomaly_baselines using ON CONFLICT (instance_id, metric_name)
    // DO UPDATE SET mean_value=..., std_dev=..., sample_count=..., computed_at=NOW()
    //
    // Invalidate in-memory cache for this instanceId after upsert.
    //
    // Log: console.info('[BaselineLearner] Baselines computed for', instanceId, '- metrics:', count)
  }
}
```

#### `AnomalyDetector` class

```typescript
export class AnomalyDetector {
  constructor(
    private readonly pool: Pool,
    private readonly alertDispatcher: { dispatch(event: unknown): Promise<void> }
  ) {}

  async detect(
    instanceId: string,
    sessionId: string,
    metrics: Partial<SessionMetrics>
  ): Promise<AnomalyResult[]> {
    // For each key in metrics:
    //   1. Load baseline from in-memory cache. If cache miss or expired,
    //      query anomaly_baselines WHERE instance_id=$1 AND metric_name=$2.
    //      If no row found, skip this metric (return nothing for it).
    //      Store in cache with expiry = now + CACHE_TTL_MS.
    //   2. If std_dev is 0 or near-zero (< 0.001), skip to avoid division by zero.
    //   3. Compute z = Math.abs((current - mean) / stdDev).
    //   4. isAnomaly = z >= Z_ANOMALY_THRESHOLD.
    //   5. Insert a row into anomaly_scores regardless of whether it is an anomaly
    //      (z-scores are useful for trending even when not flagged).
    //   6. If isAnomaly, push to results array.
    //   7. If any result has z >= Z_CRITICAL_THRESHOLD, call alertDispatcher.dispatch:
    //        {
    //          instance_id: instanceId,
    //          session_id: sessionId,
    //          event_type: 'anomaly_detected',
    //          severity: 'critical',
    //          description: JSON.stringify({ metricName, zScore, currentValue, baselineMean }),
    //          created_at: new Date(),
    //        }
    //
    // Return the results array. Return [] if no baselines exist - never throw.
  }
}
```

#### Exports

```typescript
import { pool } from '../db/pool.js';
import { alertDispatcher } from '../alerts/dispatcher.js';

export const baselineLearner = new BaselineLearner(pool);
export const anomalyDetector = new AnomalyDetector(pool, alertDispatcher);
```

---

### 3. `labyrinthscout/src/scheduler.ts` (new file)

Runs recurring jobs on Scout startup. Keep this file short.

```typescript
import { baselineLearner } from './security/anomaly-detector.js';

const BASELINE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function startScheduler(): void {
  // Run once on startup after a 30-second delay (allow DB to settle after migrations)
  // Then re-run every 24 hours.
  setTimeout(async () => {
    await runBaselines();
    setInterval(runBaselines, BASELINE_INTERVAL_MS);
  }, 30_000);
}

async function runBaselines(): Promise<void> {
  try {
    // Fetch all distinct instance_ids from security_events
    const { pool } = await import('./db/pool.js');
    const result = await pool.query<{ instance_id: string }>(
      `SELECT DISTINCT instance_id FROM security_events WHERE created_at > NOW() - INTERVAL '7 days'`
    );
    for (const row of result.rows) {
      await baselineLearner.computeBaselines(row.instance_id);
    }
  } catch (err) {
    console.error('[Scheduler] Baseline computation failed:', err);
  }
}
```

Call `startScheduler()` in the Scout server's main entry point (e.g., `labyrinthscout/src/index.ts`)
after migrations have run.

---

### 4. `labyrinthscout/src/api/admin.ts` (new file or add to existing admin router)

Expose the manual recompute endpoint.

```typescript
import { Router } from 'express';
import { baselineLearner } from '../security/anomaly-detector.js';
import { pool } from '../db/pool.js';

export const adminRouter = Router();

adminRouter.post('/recompute-baselines', async (_req, res) => {
  try {
    const result = await pool.query<{ instance_id: string }>(
      `SELECT DISTINCT instance_id FROM security_events WHERE created_at > NOW() - INTERVAL '7 days'`
    );
    for (const row of result.rows) {
      await baselineLearner.computeBaselines(row.instance_id);
    }
    res.json({ ok: true, instances: result.rows.length });
  } catch (err) {
    console.error('[Admin] recompute-baselines error:', err);
    res.status(500).json({ error: 'Baseline recomputation failed' });
  }
});
```

Mount in `labyrinthscout/src/index.ts`:

```typescript
import { adminRouter } from './api/admin.js';
app.use('/api/admin', adminRouter);
```

---

### 5. `labyrinthscout/src/api/anomalies.ts` (new file)

```typescript
import { Router } from 'express';
import { pool } from '../db/pool.js';

export const anomaliesRouter = Router();

anomaliesRouter.get('/recent', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 100);
  try {
    const result = await pool.query(
      `SELECT id, instance_id, session_id, metric_name,
              current_value, baseline_mean, z_score, is_anomaly, detected_at
       FROM anomaly_scores
       ORDER BY detected_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[Anomalies] /recent error:', err);
    res.status(500).json({ error: 'Failed to fetch anomaly scores' });
  }
});
```

Mount in `labyrinthscout/src/index.ts`:

```typescript
import { anomaliesRouter } from './api/anomalies.js';
app.use('/api/anomalies', anomaliesRouter);
```

---

### 6. `labyrinthscout/src/dashboard/index.html` (modify existing file)

Add an anomaly score panel below the existing stat cards. Fetch `GET /api/anomalies/recent?limit=10`
in the existing dashboard polling loop (or a separate 15-second interval).

HTML panel structure:

```html
<section class="panel">
  <h2 class="panel-title">Anomaly Scores (recent 10)</h2>
  <table class="anomaly-table">
    <thead>
      <tr>
        <th>Instance</th>
        <th>Metric</th>
        <th>Z-Score</th>
        <th>Current</th>
        <th>Baseline Mean</th>
        <th>Time</th>
      </tr>
    </thead>
    <tbody id="anomaly-rows">
      <tr><td colspan="6">Loading...</td></tr>
    </tbody>
  </table>
</section>
```

Colour rule applied via inline style or CSS class on the `<tr>`:
- `z_score >= 5`: text colour `#ef4444` (red)
- `z_score >= 3 and < 5`: text colour `#f59e0b` (yellow)
- Otherwise: default

JavaScript to populate:

```javascript
async function refreshAnomalies() {
  const rows = await fetch('/api/anomalies/recent?limit=10').then(r => r.json());
  const tbody = document.getElementById('anomaly-rows');
  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6">No anomalies detected yet.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(r => {
    const colour = r.z_score >= 5 ? '#ef4444' : r.z_score >= 3 ? '#f59e0b' : 'inherit';
    const time = new Date(r.detected_at).toLocaleTimeString();
    return `<tr style="color:${colour}">
      <td>${r.instance_id}</td>
      <td>${r.metric_name}</td>
      <td>${r.z_score.toFixed(2)}</td>
      <td>${r.current_value.toFixed(2)}</td>
      <td>${r.baseline_mean.toFixed(2)}</td>
      <td>${time}</td>
    </tr>`;
  }).join('');
}
setInterval(refreshAnomalies, 15000);
refreshAnomalies();
```

---

### 7. `src/security/scout-client.ts` (modify existing file)

Collect per-session metrics in Redis and call the anomaly detector periodically.

After each tool call completes in the Carina agent, increment the relevant Redis counters. Use keys
with a 6-minute TTL (slightly longer than the 5-minute window) so they auto-expire.

```typescript
// Add to the existing ScoutClient or as a standalone function exported from scout-client.ts

const METRICS_TTL_SECONDS = 360; // 6-minute rolling window
const DETECT_INTERVAL_MS = 60_000; // Send metrics to Scout every 60 seconds per session

// Call this after each tool call
export async function recordToolCall(
  sessionId: string,
  toolName: string,
  responseLength: number
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  const base = `scout:metrics:${sessionId}`;
  const multi = redis.multi();
  multi.incr(`${base}:tool_calls`);
  multi.expire(`${base}:tool_calls`, METRICS_TTL_SECONDS);
  multi.sadd(`${base}:tools_used`, toolName);
  multi.expire(`${base}:tools_used`, METRICS_TTL_SECONDS);
  multi.incrby(`${base}:total_response_length`, responseLength);
  multi.expire(`${base}:total_response_length`, METRICS_TTL_SECONDS);
  if (toolName === 'shell-exec') {
    multi.incr(`${base}:shell_count`);
    multi.expire(`${base}:shell_count`, METRICS_TTL_SECONDS);
  }
  if (toolName === 'http-request') {
    multi.incr(`${base}:http_count`);
    multi.expire(`${base}:http_count`, METRICS_TTL_SECONDS);
  }
  await multi.exec();
}

// Call this on a 60-second timer per session (use setInterval, clear on session end)
export async function flushMetricsToScout(
  instanceId: string,
  sessionId: string
): Promise<void> {
  const labyrinthEnabled = process.env.LABYRINTH_ENABLED === 'true';
  const scoutBaseUrl = process.env.SCOUT_BASE_URL;
  if (!labyrinthEnabled || !scoutBaseUrl) return;

  const redis = getRedis();
  if (!redis) return;

  const base = `scout:metrics:${sessionId}`;
  const [toolCalls, toolsUsed, totalLen, shellCount, httpCount] = await Promise.all([
    redis.get(`${base}:tool_calls`),
    redis.scard(`${base}:tools_used`),
    redis.get(`${base}:total_response_length`),
    redis.get(`${base}:shell_count`),
    redis.get(`${base}:http_count`),
  ]);

  const tc = Number(toolCalls ?? 0);
  const metrics = {
    tool_calls_per_5min: tc,
    unique_tools_used: toolsUsed,
    avg_response_length: tc > 0 ? Number(totalLen ?? 0) / tc : 0,
    shell_exec_count: Number(shellCount ?? 0),
    http_request_count: Number(httpCount ?? 0),
    injection_attempt_count: 0, // populated by Scout from its own event counts
    egress_blocked_count: 0,    // populated by Scout from its own event counts
  };

  // POST to Scout as a session_metrics event (Scout's AnomalyDetector reads these)
  await fetch(`${scoutBaseUrl}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instance_id: instanceId,
      session_id: sessionId,
      event_type: 'session_metrics',
      severity: 'info',
      description: JSON.stringify(metrics),
    }),
    signal: AbortSignal.timeout(5000),
  }).catch((err) => console.warn('[ScoutClient] Failed to flush metrics:', err));
}
```

---

## Test cases

Write in `labyrinthscout/src/security/__tests__/anomaly-detector.test.ts` using Vitest.

```typescript
describe('AnomalyDetector', () => {
  it('returns empty array when no baseline data exists', async () => {
    // Stub pool.query to return no rows for anomaly_baselines
    // detect() must return []
    // Must NOT throw
  });

  it('does not flag z-score of 2 (below threshold)', async () => {
    // Stub baseline: mean=3, std_dev=1
    // metrics: { tool_calls_per_5min: 5 } -> z = abs((5-3)/1) = 2.0
    // detect() returns []
  });

  it('flags z-score of 4 as anomaly (non-critical)', async () => {
    // Stub baseline: mean=3, std_dev=1
    // metrics: { tool_calls_per_5min: 7 } -> z = 4.0
    // detect() returns one AnomalyResult with isCritical=false
    // alertDispatcher.dispatch NOT called (z < 5)
  });

  it('dispatches critical alert when z-score exceeds 5', async () => {
    // Stub baseline: mean=3, std_dev=1
    // metrics: { tool_calls_per_5min: 9 } -> z = 6.0
    // detect() returns AnomalyResult with isCritical=true
    // alertDispatcher.dispatch IS called with severity='critical'
  });

  it('skips metric when std_dev is zero to avoid NaN', async () => {
    // Stub baseline: mean=5, std_dev=0
    // detect() returns []
  });
});

describe('BaselineLearner', () => {
  it('skips computation when fewer than 10 samples exist', async () => {
    // Stub pool.query to return 5 rows
    // No upsert should be called
  });

  it('upserts correct mean and std_dev from sample data', async () => {
    // Provide 15 rows with known metrics values
    // Assert the upserted mean and std_dev match manual calculation
  });
});
```

---

## Acceptance criteria

- `anomalyDetector.detect()` returns `[]` when no baseline rows exist (no errors, no false alarms)
- A Z-score of 6 for any metric triggers a `critical` alert via `alertDispatcher.dispatch`
- A Z-score of 2 produces no anomaly result
- `anomaly_scores` rows are inserted for every metric evaluated, not just anomalies
- Baselines are recomputed automatically every 24 hours after Scout starts
- `POST /api/admin/recompute-baselines` triggers an immediate recomputation and returns `{ ok: true }`
- `GET /api/anomalies/recent?limit=10` returns at most 10 rows, ordered newest first
- The dashboard anomaly table shows Z > 5 in red, Z 3-5 in yellow
- Carina sends `session_metrics` events to Scout at most every 60 seconds per session
- TypeScript strict mode: zero `any` types introduced
