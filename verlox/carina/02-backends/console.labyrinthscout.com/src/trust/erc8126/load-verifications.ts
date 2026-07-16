import { pool } from '../../db.js';
import { explorerTxUrl, ERC8126_SPEC_URL } from '../chain-config.js';
import type { RiskTier } from '../compute-trust-metrics.js';
import { riskTierFromScore } from '../compute-trust-metrics.js';
import type { Erc8126VerificationScores, VerificationScoreResult } from './verification-types.js';

export interface TrustVerificationRow {
  id: string;
  identity_slug: string;
  agent_id: string;
  chain_id: number;
  wav_risk_score: number;
  wv_risk_score: number;
  unified_risk_score: number;
  trust_response_score: number;
  request_hash: string;
  request_tx_hash: string | null;
  response_tx_hash: string | null;
  response_uri: string | null;
  status: 'submitted' | 'failed';
  details: Record<string, unknown>;
  submitted_at: Date;
}

export interface PublicTrustVerification {
  unified_risk_score: number;
  unified_risk_tier: RiskTier;
  unified_risk_tier_label: string;
  scores: {
    wav: VerificationScoreResult;
    wv: VerificationScoreResult;
  };
  on_chain: {
    request_hash: string;
    request_tx_hash: string | null;
    response_tx_hash: string | null;
    request_explorer_url: string | null;
    response_explorer_url: string | null;
    submitted_at: string;
  } | null;
  spec_url: string;
}

const TIER_LABELS: Record<RiskTier, string> = {
  low: 'Low risk',
  moderate: 'Moderate risk',
  elevated: 'Elevated risk',
  high: 'High risk',
  critical: 'Critical risk',
};

export async function loadLatestTrustVerification(
  slug = 'carina-reference',
): Promise<TrustVerificationRow | null> {
  const result = await pool.query<TrustVerificationRow>(
    `SELECT id, identity_slug, agent_id, chain_id, wav_risk_score, wv_risk_score,
            unified_risk_score, trust_response_score, request_hash, request_tx_hash,
            response_tx_hash, response_uri, status, details, submitted_at
     FROM trust_verifications
     WHERE identity_slug = $1 AND status = 'submitted'
     ORDER BY submitted_at DESC
     LIMIT 1`,
    [slug],
  );

  return result.rows[0] ?? null;
}

export async function getLastVerificationAt(slug = 'carina-reference'): Promise<Date | null> {
  const result = await pool.query<{ submitted_at: Date }>(
    `SELECT submitted_at
     FROM trust_verifications
     WHERE identity_slug = $1 AND status = 'submitted'
     ORDER BY submitted_at DESC
     LIMIT 1`,
    [slug],
  );

  return result.rows[0]?.submitted_at ?? null;
}

export function mapVerificationRowToPublic(row: TrustVerificationRow): PublicTrustVerification {
  const details = row.details as {
    scores?: Erc8126VerificationScores;
  };

  const wav: VerificationScoreResult = details.scores?.wav ?? {
    applicable: true,
    risk_score: row.wav_risk_score,
    notes: 'WAV score from stored verification',
    checks: {},
  };

  const wv: VerificationScoreResult = details.scores?.wv ?? {
    applicable: true,
    risk_score: row.wv_risk_score,
    notes: 'WV score from stored verification',
    checks: {},
  };

  const tier = riskTierFromScore(row.unified_risk_score);

  return {
    unified_risk_score: row.unified_risk_score,
    unified_risk_tier: tier,
    unified_risk_tier_label: TIER_LABELS[tier],
    scores: { wav, wv },
    on_chain: {
      request_hash: row.request_hash,
      request_tx_hash: row.request_tx_hash,
      response_tx_hash: row.response_tx_hash,
      request_explorer_url: row.request_tx_hash
        ? explorerTxUrl(row.chain_id, row.request_tx_hash)
        : null,
      response_explorer_url: row.response_tx_hash
        ? explorerTxUrl(row.chain_id, row.response_tx_hash)
        : null,
      submitted_at: new Date(row.submitted_at).toISOString(),
    },
    spec_url: ERC8126_SPEC_URL,
  };
}

export async function storeTrustVerification(input: {
  identitySlug: string;
  agentId: string;
  chainId: number;
  wavRiskScore: number;
  wvRiskScore: number;
  unifiedRiskScore: number;
  trustResponseScore: number;
  requestHash: string;
  requestTxHash: string | null;
  responseTxHash: string | null;
  responseUri: string | null;
  details: Record<string, unknown>;
}): Promise<void> {
  await pool.query(
    `INSERT INTO trust_verifications (
       identity_slug, agent_id, chain_id, wav_risk_score, wv_risk_score,
       unified_risk_score, trust_response_score, request_hash, request_tx_hash,
       response_tx_hash, response_uri, status, details
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'submitted', $12::jsonb)`,
    [
      input.identitySlug,
      input.agentId,
      input.chainId,
      input.wavRiskScore,
      input.wvRiskScore,
      input.unifiedRiskScore,
      input.trustResponseScore,
      input.requestHash,
      input.requestTxHash,
      input.responseTxHash,
      input.responseUri,
      JSON.stringify(input.details),
    ],
  );
}
