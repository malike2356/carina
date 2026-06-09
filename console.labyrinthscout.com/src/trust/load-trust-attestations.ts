import { pool } from '../db.js';
import { explorerTxUrl } from './chain-config.js';
import type { TrustAttestation } from './compute-trust-metrics.js';
import type { LabyrinthScoutAttestationFields } from './attestation-namespace.js';

export interface TrustAttestationRow {
  id: string;
  identity_slug: string;
  namespace: string;
  tag: string;
  score: number;
  attestation_uid: string | null;
  tx_hash: string;
  chain_id: number;
  metrics: LabyrinthScoutAttestationFields | Record<string, unknown>;
  comment: string | null;
  status: 'submitted' | 'failed';
  submitted_at: Date;
}

export async function loadRecentTrustAttestations(
  slug = 'carina-reference',
  limit = 5,
): Promise<TrustAttestationRow[]> {
  const result = await pool.query<TrustAttestationRow>(
    `SELECT id, identity_slug, namespace, tag, score, attestation_uid, tx_hash,
            chain_id, metrics, comment, status, submitted_at
     FROM trust_attestations
     WHERE identity_slug = $1 AND status = 'submitted'
     ORDER BY submitted_at DESC
     LIMIT $2`,
    [slug, limit],
  );

  return result.rows;
}

export async function getLastAttestationAt(slug = 'carina-reference'): Promise<Date | null> {
  const result = await pool.query<{ submitted_at: Date }>(
    `SELECT submitted_at
     FROM trust_attestations
     WHERE identity_slug = $1 AND status = 'submitted'
     ORDER BY submitted_at DESC
     LIMIT 1`,
    [slug],
  );

  return result.rows[0]?.submitted_at ?? null;
}

export function mapAttestationRowToPublic(row: TrustAttestationRow): TrustAttestation {
  const metrics = row.metrics as LabyrinthScoutAttestationFields;
  const runtimeHours = typeof metrics.runtimeHours === 'number' ? metrics.runtimeHours : 0;
  const isCleanRuntime = row.tag === 'runtime.clean' || runtimeHours >= 720;

  return {
    type: 'On-chain',
    title: isCleanRuntime ? '30-day clean runtime (on-chain)' : 'Security summary (on-chain)',
    summary: isCleanRuntime
      ? `Scout attested ${runtimeHours}h without critical incidents. Security score ${row.score}/100.`
      : `Scout security attestation posted. Score ${row.score}/100.`,
    hash_preview: row.tx_hash.slice(0, 6) + '...' + row.tx_hash.slice(-4),
    at: new Date(row.submitted_at).toISOString(),
    on_chain: {
      uid: row.attestation_uid,
      tx_hash: row.tx_hash,
      explorer_url: explorerTxUrl(row.chain_id, row.tx_hash),
      namespace: row.namespace,
      tag: row.tag,
      score: row.score,
    },
  };
}

export async function storeTrustAttestation(input: {
  identitySlug: string;
  namespace: string;
  tag: string;
  score: number;
  txHash: string;
  chainId: number;
  metrics: LabyrinthScoutAttestationFields;
  comment: string;
  attestationUid?: string | null;
}): Promise<void> {
  await pool.query(
    `INSERT INTO trust_attestations (
       identity_slug, namespace, tag, score, attestation_uid, tx_hash,
       chain_id, metrics, comment, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, 'submitted')`,
    [
      input.identitySlug,
      input.namespace,
      input.tag,
      input.score,
      input.attestationUid ?? null,
      input.txHash,
      input.chainId,
      JSON.stringify(input.metrics),
      input.comment,
    ],
  );
}
