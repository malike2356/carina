import { pool } from '../db.js';
import { explorerTxUrl } from './chain-config.js';

export interface TrustHistoryAttestation {
  kind: 'agent-trust';
  namespace: string;
  tag: string;
  score: number;
  tx_hash: string;
  explorer_url: string;
  submitted_at: string;
}

export interface TrustHistoryVerification {
  kind: 'erc8126';
  unified_risk_score: number;
  wav_risk_score: number;
  wv_risk_score: number;
  request_hash: string;
  request_tx_hash: string | null;
  response_tx_hash: string | null;
  request_explorer_url: string | null;
  response_explorer_url: string | null;
  submitted_at: string;
}

export interface TrustHistoryPayload {
  identity_slug: string;
  agent_id: string | null;
  attestations: TrustHistoryAttestation[];
  verifications: TrustHistoryVerification[];
}

export async function buildTrustHistory(slug = 'carina-reference'): Promise<TrustHistoryPayload> {
  const [identity, attestations, verifications] = await Promise.all([
    pool.query<{ agent_id: string | null }>(
      `SELECT agent_id FROM trust_identities WHERE slug = $1 LIMIT 1`,
      [slug],
    ),
    pool.query<{
      namespace: string;
      tag: string;
      score: number;
      tx_hash: string;
      chain_id: number;
      submitted_at: Date;
    }>(
      `SELECT namespace, tag, score, tx_hash, chain_id, submitted_at
       FROM trust_attestations
       WHERE identity_slug = $1 AND status = 'submitted'
       ORDER BY submitted_at DESC
       LIMIT 50`,
      [slug],
    ),
    pool.query<{
      unified_risk_score: number;
      wav_risk_score: number;
      wv_risk_score: number;
      request_hash: string;
      request_tx_hash: string | null;
      response_tx_hash: string | null;
      chain_id: number;
      submitted_at: Date;
    }>(
      `SELECT unified_risk_score, wav_risk_score, wv_risk_score, request_hash,
              request_tx_hash, response_tx_hash, chain_id, submitted_at
       FROM trust_verifications
       WHERE identity_slug = $1 AND status = 'submitted'
       ORDER BY submitted_at DESC
       LIMIT 50`,
      [slug],
    ),
  ]);

  return {
    identity_slug: slug,
    agent_id: identity.rows[0]?.agent_id ?? null,
    attestations: attestations.rows.map((row) => ({
      kind: 'agent-trust',
      namespace: row.namespace,
      tag: row.tag,
      score: row.score,
      tx_hash: row.tx_hash,
      explorer_url: explorerTxUrl(row.chain_id, row.tx_hash),
      submitted_at: new Date(row.submitted_at).toISOString(),
    })),
    verifications: verifications.rows.map((row) => ({
      kind: 'erc8126',
      unified_risk_score: row.unified_risk_score,
      wav_risk_score: row.wav_risk_score,
      wv_risk_score: row.wv_risk_score,
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
    })),
  };
}
