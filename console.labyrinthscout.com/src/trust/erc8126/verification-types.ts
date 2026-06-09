import type { RiskTier } from '../compute-trust-metrics.js';
import { riskTierFromScore } from '../compute-trust-metrics.js';

export const ERC8126_VERIFICATION_TAG = 'erc8126.v1' as const;

export interface VerificationScoreResult {
  applicable: boolean;
  risk_score: number;
  notes: string;
  checks: Record<string, unknown>;
}

export interface Erc8126VerificationScores {
  wav: VerificationScoreResult;
  wv: VerificationScoreResult;
}

export interface Erc8126VerificationPayload {
  standard: 'ERC-8126';
  version: 1;
  agentId: string;
  generatedAt: string;
  scores: Erc8126VerificationScores;
  unifiedRiskScore: number;
  unifiedRiskTier: RiskTier;
  provider: 'labyrinth-scout';
}

export function computeUnifiedRiskScore(scores: Erc8126VerificationScores): number {
  const applicable = [scores.wav, scores.wv].filter((item) => item.applicable);
  if (applicable.length === 0) return 100;

  const total = applicable.reduce((sum, item) => sum + item.risk_score, 0);
  return Math.min(100, Math.max(0, Math.round(total / applicable.length)));
}

export function trustResponseFromRisk(riskScore: number): number {
  return Math.min(100, Math.max(0, 100 - riskScore));
}

export function buildVerificationPayload(
  agentId: string,
  scores: Erc8126VerificationScores,
  now = new Date(),
): Erc8126VerificationPayload {
  const unifiedRiskScore = computeUnifiedRiskScore(scores);
  return {
    standard: 'ERC-8126',
    version: 1,
    agentId,
    generatedAt: now.toISOString(),
    scores,
    unifiedRiskScore,
    unifiedRiskTier: riskTierFromScore(unifiedRiskScore),
    provider: 'labyrinth-scout',
  };
}
