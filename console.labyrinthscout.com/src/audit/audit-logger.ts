import { pool } from '../db.js';
import type { AuditEvent, AuditEventType, AuditSeverity } from './audit-schemas.js';

/**
 * Thin normalizing writer that maps events from call sites into the
 * AuditEvent shape and inserts into the immutable audit_log table.
 *
 * Every insert goes through this single function — there is no other
 * write path into audit_log. The kill-switch audit module also
 * delegates through this function (with event_type="admin",
 * action="kill_switch_triggered" / "kill_switch_disarmed").
 */
export async function logAuditEvent(event: AuditEvent): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO audit_log
       (tenant_id, event_type, action, detail, severity, session_id, ip_address, admin_email)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      event.tenant_id,
      event.event_type,
      event.action,
      JSON.stringify(event.detail),
      event.severity,
      event.session_id ?? null,
      event.ip_address ?? null,
      event.admin_email ?? null,
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to insert audit log entry');
  }

  return row.id;
}

/**
 * Convenience helpers for each event category, enforcing the expected
 * detail payload shapes per spec lines 45-79.
 */

export async function logToolExecution(params: {
  tenant_id: string;
  action: string;
  detail: {
    tool_name: string;
    tool_call_id?: string;
    duration_ms: number;
    success: boolean;
    error?: string;
    input_params?: Record<string, unknown>;
  };
  severity: AuditSeverity;
  session_id?: string;
  ip_address?: string;
}): Promise<string> {
  return logAuditEvent({
    tenant_id: params.tenant_id,
    event_type: 'tool_execution',
    action: params.action,
    detail: params.detail as Record<string, unknown>,
    severity: params.severity,
    session_id: params.session_id,
    ip_address: params.ip_address,
  });
}

export async function logModelRequest(params: {
  tenant_id: string;
  action: string;
  detail: {
    model: string;
    provider?: string;
    prompt_tokens?: number;
    completion_tokens?: number;
    duration_ms: number;
    success: boolean;
    error?: string;
  };
  severity: AuditSeverity;
  session_id?: string;
  ip_address?: string;
}): Promise<string> {
  return logAuditEvent({
    tenant_id: params.tenant_id,
    event_type: 'model_request',
    action: params.action,
    detail: params.detail as Record<string, unknown>,
    severity: params.severity,
    session_id: params.session_id,
    ip_address: params.ip_address,
  });
}

export async function logSecurityEvent(params: {
  tenant_id: string;
  action: string;
  detail: {
    source: string;
    description: string;
    metadata?: Record<string, unknown>;
    instance_id?: string;
  };
  severity: AuditSeverity;
  session_id?: string;
  ip_address?: string;
}): Promise<string> {
  return logAuditEvent({
    tenant_id: params.tenant_id,
    event_type: 'security',
    action: params.action,
    detail: params.detail as Record<string, unknown>,
    severity: params.severity,
    session_id: params.session_id,
    ip_address: params.ip_address,
  });
}

export async function logAdminAction(params: {
  tenant_id: string;
  action: string;
  detail: Record<string, unknown>;
  severity: AuditSeverity;
  admin_email?: string;
  session_id?: string;
  ip_address?: string;
}): Promise<string> {
  return logAuditEvent({
    tenant_id: params.tenant_id,
    event_type: 'admin',
    action: params.action,
    detail: params.detail,
    severity: params.severity,
    admin_email: params.admin_email,
    session_id: params.session_id,
    ip_address: params.ip_address,
  });
}

export async function logAuthEvent(params: {
  tenant_id: string;
  action: string;
  detail: {
    email?: string;
    account_id?: string;
    success: boolean;
    failure_reason?: string;
  };
  severity: AuditSeverity;
  session_id?: string;
  ip_address?: string;
}): Promise<string> {
  return logAuditEvent({
    tenant_id: params.tenant_id,
    event_type: 'auth',
    action: params.action,
    detail: params.detail as Record<string, unknown>,
    severity: params.severity,
    session_id: params.session_id,
    ip_address: params.ip_address,
  });
}
