import { pool } from '../db.js';
import { attestCriticalSecurityEvent } from '../trust/critical-event-attestation.js';
import type { SecurityEventRow } from '../types.js';
import { broadcastEvent, refreshAndBroadcastStats } from '../api/sse.js';

export type ProtectAuditInput = {
  eventType: string;
  severity?: 'info' | 'warning' | 'critical' | 'breach';
  description: string;
  accountId?: string;
  sessionId?: string;
  instanceId?: string;
  metadata?: Record<string, unknown>;
};

/** Write a security event and hash-chain attest when critical/breach. */
export async function recordProtectAuditEvent(input: ProtectAuditInput): Promise<SecurityEventRow | null> {
  const severity = input.severity ?? 'critical';
  const metadata = {
    ...(input.metadata ?? {}),
    ...(input.accountId ? { account_id: input.accountId } : {}),
    chain_of_custody: {
      recorded_at: new Date().toISOString(),
      source: 'protect-audit',
    },
  };

  const result = await pool.query<SecurityEventRow>(
    `INSERT INTO security_events
       (severity, source, event_type, description, metadata, session_id, instance_id)
     VALUES ($1, 'protect', $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      severity,
      input.eventType,
      input.description,
      JSON.stringify(metadata),
      input.sessionId ?? null,
      input.instanceId ?? null,
    ],
  );

  const inserted = result.rows[0];
  if (!inserted) return null;

  const event: SecurityEventRow = {
    ...inserted,
    metadata:
      typeof inserted.metadata === 'object' && inserted.metadata !== null
        ? (inserted.metadata as Record<string, unknown>)
        : {},
    created_at: new Date(inserted.created_at).toISOString(),
  };

  broadcastEvent(event);
  void refreshAndBroadcastStats();
  await attestCriticalSecurityEvent(event);
  return event;
}
