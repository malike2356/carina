import {
  countOpenFindingsBySeverity,
  countOpenPortsWithoutVuln,
  recordScoreSnapshot,
} from './store.js';
import type { ScoutScoreSnapshot } from './types.js';
import { buildScoreBreakdown, calculateScoutScore } from './score-calc.js';

export { buildScoreBreakdown, calculateScoutScore } from './score-calc.js';

export async function getCurrentScoutScore(
  accountId: string,
  persist = true,
): Promise<ScoutScoreSnapshot> {
  const counts = await countOpenFindingsBySeverity(accountId);
  const openPorts = await countOpenPortsWithoutVuln(accountId);
  const score = calculateScoutScore({
    critical: counts.critical,
    high: counts.high,
    medium: counts.medium,
    low: counts.low,
    info: counts.info,
    openPorts,
  });

  const breakdown = buildScoreBreakdown({
    critical: counts.critical,
    high: counts.high,
    medium: counts.medium,
    low: counts.low,
    openPorts,
  });

  const snapshot = {
    score,
    openCritical: counts.critical,
    openHigh: counts.high,
    openMedium: counts.medium,
    openLow: counts.low,
    openPorts,
    label: 'findings posture',
    breakdown,
  };

  if (persist) {
    try {
      const recorded = await recordScoreSnapshot(accountId, snapshot);
      return {
        ...recorded,
        openPorts,
        label: 'findings posture',
        breakdown,
      };
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== '23503') throw err;
      // Account does not exist in this Scout DB (e.g. operator proxy); return without persisting.
    }
  }

  return {
    ...snapshot,
    calculatedAt: new Date().toISOString(),
  };
}
