import { pool } from './db.js';
import { baselineLearner } from './security/anomaly-detector.js';
import { runRetention } from './audit/audit-retention.js';

const BASELINE_INTERVAL_MS = 24 * 60 * 60 * 1000;
const RETENTION_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours
const STARTUP_DELAY_MS = 30_000;

export function startScheduler(): void {
  setTimeout(() => {
    void runBaselines();
    setInterval(() => void runBaselines(), BASELINE_INTERVAL_MS);
  }, STARTUP_DELAY_MS);

  // Retention job: runs on startup + every 6 hours.
  // Applies per-event-type retention windows (90-730 days).
  setTimeout(() => {
    void runRetention();
    setInterval(() => void runRetention(), RETENTION_INTERVAL_MS);
  }, STARTUP_DELAY_MS + 5_000);
}

async function runBaselines(): Promise<void> {
  try {
    const result = await pool.query<{ instance_id: string }>(
      `SELECT DISTINCT instance_id FROM security_events
       WHERE instance_id IS NOT NULL
         AND created_at > NOW() - INTERVAL '7 days'`,
    );
    for (const row of result.rows) {
      if (row.instance_id) {
        await baselineLearner.computeBaselines(row.instance_id);
      }
    }
  } catch (err) {
    console.error('[Scheduler] Baseline computation failed:', err);
  }
}
