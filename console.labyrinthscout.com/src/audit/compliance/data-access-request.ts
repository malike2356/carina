import { pool } from '../../db.js';
import type { AuditLogRow } from '../audit-schemas.js';

/**
 * SAR (Subject Access Request) handler per GDPR Article 15.
 *
 * Accepts a tenant_id and email, queries every table that contains
 * tenant-associated data, and returns a complete machine-readable
 * JSON export. Records the request with a 30-day due date.
 */

export interface SarRequest {
  tenant_id: string;
  email: string;
}

export interface SarExport {
  request_id: string;
  tenant_id: string;
  email: string;
  requested_at: string;
  due_by: string;
  data: {
    audit_events: AuditLogRow[];
    security_events: Record<string, unknown>[];
    accounts: Record<string, unknown>[];
    carina_instances: Record<string, unknown>[];
    blocked_sessions: Record<string, unknown>[];
    throttle_state: Record<string, unknown>[];
  };
}

export async function handleDataAccessRequest(
  params: SarRequest,
): Promise<SarExport> {
  const { tenant_id, email } = params;

  // Record the compliance request
  const reqResult = await pool.query<{
    id: string;
    requested_at: string;
    due_by: string;
  }>(
    `INSERT INTO compliance_requests
       (request_type, tenant_id, email, due_by)
     VALUES ('sar', $1, $2, NOW() + INTERVAL '30 days')
     RETURNING id, requested_at, due_by`,
    [tenant_id, email],
  );

  const reqRow = reqResult.rows[0];
  if (!reqRow) {
    throw new Error('Failed to record SAR compliance request');
  }

  // Gather all tenant-associated data from every relevant table.
  // We query each table independently so partial failures in one
  // table do not prevent export of data from others.

  const auditEvents = await pool
    .query<AuditLogRow>(
      `SELECT id, tenant_id, event_type, action, detail, severity,
              session_id, ip_address, admin_email, timestamp
       FROM audit_log
       WHERE tenant_id = $1
       ORDER BY timestamp DESC`,
      [tenant_id],
    )
    .then((r) => r.rows)
    .catch((err) => {
      console.error('[compliance:sar] audit_log query failed:', err);
      return [];
    });

  const securityEvents = await pool
    .query<Record<string, unknown>>(
      `SELECT id, severity, source, event_type, description, metadata,
              ip_address, session_id, instance_id, mitigated, created_at,
              acknowledged, acknowledged_at, acknowledged_note
       FROM security_events
       WHERE instance_id IN (
         SELECT id FROM carina_instances
         WHERE account_id IN (
           SELECT id FROM accounts WHERE email = $1
         )
         UNION
         SELECT id FROM carina_instances WHERE account_id IS NULL
           AND id = $2
       )
       ORDER BY created_at DESC`,
      [email, tenant_id],
    )
    .then((r) => r.rows)
    .catch((err) => {
      console.error('[compliance:sar] security_events query failed:', err);
      return [];
    });

  const accounts = await pool
    .query<Record<string, unknown>>(
      `SELECT id, email, created_at
       FROM accounts
       WHERE email = $1`,
      [email],
    )
    .then((r) => r.rows)
    .catch((err) => {
      console.error('[compliance:sar] accounts query failed:', err);
      return [];
    });

  const carinaInstances = await pool
    .query<Record<string, unknown>>(
      `SELECT id, name, status, suspension_reason,
              last_heartbeat, created_at
       FROM carina_instances
       WHERE account_id IN (
         SELECT id FROM accounts WHERE email = $1
       )
       OR id = $2`,
      [email, tenant_id],
    )
    .then((r) => r.rows)
    .catch((err) => {
      console.error('[compliance:sar] carina_instances query failed:', err);
      return [];
    });

  const blockedSessions = await pool
    .query<Record<string, unknown>>(
      `SELECT session_id, reason, blocked_by, blocked_at
       FROM blocked_sessions
       WHERE blocked_by = $1`,
      [tenant_id],
    )
    .then((r) => r.rows)
    .catch((err) => {
      console.error('[compliance:sar] blocked_sessions query failed:', err);
      return [];
    });

  const throttleState = await pool
    .query<Record<string, unknown>>(
      `SELECT tenant_id, severity, event_type, count, window_started_at
       FROM throttle_state
       WHERE tenant_id = $1`,
      [tenant_id],
    )
    .then((r) => r.rows)
    .catch((err) => {
      console.error('[compliance:sar] throttle_state query failed:', err);
      return [];
    });

  return {
    request_id: reqRow.id,
    tenant_id,
    email,
    requested_at: new Date(reqRow.requested_at).toISOString(),
    due_by: new Date(reqRow.due_by).toISOString(),
    data: {
      audit_events: auditEvents.map((r) => ({
        ...r,
        timestamp: new Date(r.timestamp).toISOString(),
      })),
      security_events: securityEvents,
      accounts,
      carina_instances: carinaInstances,
      blocked_sessions: blockedSessions,
      throttle_state: throttleState,
    },
  };
}
