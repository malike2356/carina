import {
  countOpenFindingsBySeverity,
  countOpenPortsWithoutVuln,
  recordScoreSnapshot,
} from './store.js';
import type { ScoutScoreSnapshot } from './types.js';

export function calculateScoutScore(counts: {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  openPorts: number;
}): number {
  let score = 100;
  score -= counts.critical * 10;
  score -= counts.high * 5;
  score -= counts.medium * 2;
  score -= counts.openPorts * 1;
  return Math.max(0, Math.min(100, score));
}

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

  const snapshot = {
    score,
    openCritical: counts.critical,
    openHigh: counts.high,
    openMedium: counts.medium,
    openLow: counts.low,
  };

  if (persist) {
    try {
      return await recordScoreSnapshot(accountId, snapshot);
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
