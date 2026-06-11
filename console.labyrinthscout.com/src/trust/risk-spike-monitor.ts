import { buildPublicTrustFromDb } from './build-public-trust.js';
import { emitTrustAlert } from './trust-alerts.js';

const SPIKE_THRESHOLD = 15;
let lastRiskScore: number | null = null;

export async function checkRiskScoreSpike(): Promise<void> {
  try {
    const payload = await buildPublicTrustFromDb();
    const current = payload.risk_score;
    if (lastRiskScore !== null && current - lastRiskScore >= SPIKE_THRESHOLD) {
      await emitTrustAlert(
        'risk_score_spike',
        'warning',
        `Risk score rose from ${lastRiskScore} to ${current} (+${current - lastRiskScore})`,
        { previous: lastRiskScore, current, delta: current - lastRiskScore },
      );
    }
    lastRiskScore = current;
  } catch (err) {
    console.error('[risk-spike-monitor] Check failed:', err);
  }
}

export function resetRiskSpikeBaseline(score: number | null = null): void {
  lastRiskScore = score;
}
