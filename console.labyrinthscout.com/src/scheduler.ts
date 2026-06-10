import { pool } from './db.js';
import { config } from './config/index.js';
import { baselineLearner } from './security/anomaly-detector.js';
import { runRetention } from './audit/audit-retention.js';
import { runWeeklyAttestation } from './trust/run-weekly-attestation.js';
import { runWeeklyVerification } from './trust/erc8126/run-weekly-verification.js';
import { startRotationScheduler } from './deception/rotation-scheduler.js';
import { movingTarget } from './deception/moving-target.js';

const BASELINE_INTERVAL_MS = 24 * 60 * 60 * 1000;
const RETENTION_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours
const ATTESTATION_INTERVAL_MS = config.trust.attestationIntervalDays * 24 * 60 * 60 * 1000;
const STARTUP_DELAY_MS = 30_000;

export function startScheduler(): void {
  void movingTarget.loadHistory().catch((err) => {
    console.warn('[Scheduler] Moving-target history load failed:', err);
  });
  startRotationScheduler();
  console.log('[Scheduler] Moving-target deception rotation started');

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

  if (config.trust.attestationEnabled) {
    setTimeout(() => {
      void runTrustAttestation();
      setInterval(() => void runTrustAttestation(), ATTESTATION_INTERVAL_MS);
    }, STARTUP_DELAY_MS + 10_000);
  }

  if (config.trust.verificationEnabled) {
    const verificationIntervalMs = config.trust.verificationIntervalDays * 24 * 60 * 60 * 1000;
    setTimeout(() => {
      void runTrustVerification();
      setInterval(() => void runTrustVerification(), verificationIntervalMs);
    }, STARTUP_DELAY_MS + 15_000);
  }
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

async function runTrustVerification(): Promise<void> {
  try {
    const result = await runWeeklyVerification();
    if (result.ok) {
      console.log('[Scheduler] ERC-8126 verification submitted:', result.responseTxHash);
      return;
    }
    if (!result.skipped) {
      console.error('[Scheduler] ERC-8126 verification failed:', result.reason);
      return;
    }
    console.log('[Scheduler] ERC-8126 verification skipped:', result.reason);
  } catch (err) {
    console.error('[Scheduler] ERC-8126 verification job failed:', err);
  }
}

async function runTrustAttestation(): Promise<void> {
  try {
    const result = await runWeeklyAttestation();
    if (result.ok) {
      console.log('[Scheduler] Trust attestation submitted:', result.txHash);
      return;
    }
    if (!result.skipped) {
      console.error('[Scheduler] Trust attestation failed:', result.reason);
      return;
    }
    console.log('[Scheduler] Trust attestation skipped:', result.reason);
  } catch (err) {
    console.error('[Scheduler] Trust attestation job failed:', err);
  }
}
