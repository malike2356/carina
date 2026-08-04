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

export function buildScoreBreakdown(counts: {
  critical: number;
  high: number;
  medium: number;
  low: number;
  openPorts: number;
}): NonNullable<ScoutScoreSnapshot['breakdown']> {
  const vulnerabilities = Math.max(
    0,
    100 - counts.critical * 10 - counts.high * 5 - counts.medium * 2 - counts.low * 1,
  );
  const exposure = Math.max(0, 100 - counts.openPorts * 5);
  const compliance = Math.max(0, 100 - counts.critical * 15 - counts.high * 8);
  const agentSafety = Math.max(
    0,
    100 - counts.critical * 12 - counts.high * 6,
  );

  return {
    exposure,
    vulnerabilities,
    compliance,
    agentSafety,
  };
}
