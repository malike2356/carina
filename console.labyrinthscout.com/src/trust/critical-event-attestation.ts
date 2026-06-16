import crypto from 'node:crypto';
import { pool } from '../db.js';
import type { SecurityEventRow } from '../types.js';

export const CRITICAL_ATTESTATION_EVENT_TYPES = new Set([
  'tool_blocked',
  'dangerous_command_blocked',
  'prompt_injection_blocked',
  'data_exfiltration_blocked',
  'kill_switch_activated',
  'breach_detected',
  'policy_blocked',
  'quarantine_session',
]);

export type CriticalEventAttestation = {
  id: string;
  eventId: string;
  eventType: string;
  severity: string;
  instanceId: string | null;
  contentHash: string;
  chainHash: string;
  signature: string;
  attestedAt: string;
  onChainStatus: 'off_chain' | 'queued' | 'submitted';
};

function attestationSecret(): string {
  return process.env.SCOUT_ATTESTATION_HMAC_SECRET
    ?? process.env.LABYRINTH_API_KEY
    ?? 'scout-dev-attestation-secret';
}

export function shouldAttestCriticalEvent(severity: string, eventType: string): boolean {
  if (severity === 'breach') return true;
  if (severity === 'critical' && CRITICAL_ATTESTATION_EVENT_TYPES.has(eventType)) return true;
  return false;
}

export function hashEventPayload(event: Pick<SecurityEventRow, 'id' | 'event_type' | 'severity' | 'instance_id' | 'created_at' | 'metadata'>): string {
  const canonical = JSON.stringify({
    event_id: event.id,
    event_type: event.event_type,
    severity: event.severity,
    instance_id: event.instance_id ?? null,
    created_at: new Date(event.created_at).toISOString(),
    metadata: event.metadata ?? {},
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

export function buildChainHash(previousHash: string | null, contentHash: string): string {
  return crypto
    .createHash('sha256')
    .update(`${previousHash ?? ''}:${contentHash}`)
    .digest('hex');
}

export function signAttestation(chainHash: string): string {
  return crypto.createHmac('sha256', attestationSecret()).update(chainHash).digest('hex');
}

async function getLastChainHash(): Promise<string | null> {
  const result = await pool.query<{ chain_hash: string }>(
    `SELECT chain_hash FROM critical_event_attestations
     ORDER BY attested_at DESC
     LIMIT 1`,
  );
  return result.rows[0]?.chain_hash ?? null;
}

export async function attestCriticalSecurityEvent(
  event: SecurityEventRow,
): Promise<CriticalEventAttestation | null> {
  if (!shouldAttestCriticalEvent(event.severity, event.event_type)) {
    return null;
  }

  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM critical_event_attestations WHERE event_id = $1 LIMIT 1`,
    [event.id],
  );
  if (existing.rows[0]) return null;

  const contentHash = hashEventPayload(event);
  const previousHash = await getLastChainHash();
  const chainHash = buildChainHash(previousHash, contentHash);
  const signature = signAttestation(chainHash);

  const result = await pool.query<{
    id: string;
    attested_at: Date;
    on_chain_status: 'off_chain' | 'queued' | 'submitted';
  }>(
    `INSERT INTO critical_event_attestations (
       event_id, event_type, severity, instance_id,
       content_hash, chain_hash, signature, on_chain_status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'off_chain')
     RETURNING id, attested_at, on_chain_status`,
    [
      event.id,
      event.event_type,
      event.severity,
      event.instance_id ?? null,
      contentHash,
      chainHash,
      signature,
    ],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    eventId: event.id,
    eventType: event.event_type,
    severity: event.severity,
    instanceId: event.instance_id ?? null,
    contentHash,
    chainHash,
    signature,
    attestedAt: new Date(row.attested_at).toISOString(),
    onChainStatus: row.on_chain_status,
  };
}

export async function verifyCriticalAttestation(
  attestationId: string,
): Promise<{ valid: boolean; reason?: string; attestation?: CriticalEventAttestation }> {
  const result = await pool.query<{
    id: string;
    event_id: string;
    event_type: string;
    severity: string;
    instance_id: string | null;
    content_hash: string;
    chain_hash: string;
    signature: string;
    attested_at: Date;
    on_chain_status: 'off_chain' | 'queued' | 'submitted';
  }>(
    `SELECT id, event_id, event_type, severity, instance_id,
            content_hash, chain_hash, signature, attested_at, on_chain_status
     FROM critical_event_attestations
     WHERE id = $1`,
    [attestationId],
  );
  const row = result.rows[0];
  if (!row) return { valid: false, reason: 'Attestation not found' };

  const expectedSig = signAttestation(row.chain_hash);
  if (expectedSig !== row.signature) {
    return { valid: false, reason: 'Signature mismatch' };
  }

  return {
    valid: true,
    attestation: {
      id: row.id,
      eventId: row.event_id,
      eventType: row.event_type,
      severity: row.severity,
      instanceId: row.instance_id,
      contentHash: row.content_hash,
      chainHash: row.chain_hash,
      signature: row.signature,
      attestedAt: new Date(row.attested_at).toISOString(),
      onChainStatus: row.on_chain_status,
    },
  };
}

export async function countCriticalAttestations(sinceHours = 24): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM critical_event_attestations
     WHERE attested_at > NOW() - ($1::text || ' hours')::interval`,
    [String(sinceHours)],
  );
  return parseInt(result.rows[0]?.count ?? '0', 10);
}
