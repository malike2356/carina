import { randomUUID } from 'node:crypto';
import { pool } from '../db.js';
import { alertDispatcher, toSecurityEvent } from '../alerts/dispatcher.js';
import type { SecurityEventRow, Severity } from '../types.js';

export async function emitTrustAlert(
  eventType: string,
  severity: Severity,
  description: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const id = randomUUID();
  try {
    const result = await pool.query<SecurityEventRow>(
      `INSERT INTO security_events
         (id, severity, source, event_type, description, metadata, instance_id, created_at)
       VALUES ($1, $2, 'labyrinth-trust', $3, $4, $5, 'trust-scheduler', NOW())
       RETURNING *`,
      [id, severity, eventType, description, JSON.stringify(metadata)],
    );
    const row = result.rows[0];
    if (!row) return;
    const normalized: SecurityEventRow = {
      ...row,
      metadata: typeof row.metadata === 'object' && row.metadata !== null
        ? row.metadata as Record<string, unknown>
        : {},
      created_at: new Date(row.created_at).toISOString(),
      acknowledged: false,
      acknowledged_at: null,
      acknowledged_note: null,
    };
    await alertDispatcher.dispatch(toSecurityEvent(normalized));
  } catch (err) {
    console.error(`[trust-alerts] Failed to emit ${eventType}:`, err);
  }
}
