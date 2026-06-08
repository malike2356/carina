// Audit event schemas per spec lines 25-40
// Five event categories: tool_execution, model_request, security, admin, auth

export type AuditEventType =
  | 'tool_execution'
  | 'model_request'
  | 'security'
  | 'admin'
  | 'auth';

export type AuditSeverity = 'info' | 'warning' | 'critical' | 'breach';

export interface AuditEvent {
  tenant_id: string;
  event_type: AuditEventType;
  action: string;
  detail: Record<string, unknown>;
  severity: AuditSeverity;
  session_id?: string;
  ip_address?: string;
  admin_email?: string;
}

export interface AuditLogRow {
  id: string;
  tenant_id: string;
  event_type: AuditEventType;
  action: string;
  detail: Record<string, unknown>;
  severity: AuditSeverity;
  session_id: string | null;
  ip_address: string | null;
  admin_email: string | null;
  timestamp: string;
}

export const AUDIT_EVENT_TYPES: AuditEventType[] = [
  'tool_execution',
  'model_request',
  'security',
  'admin',
  'auth',
];

export const AUDIT_SEVERITIES: AuditSeverity[] = [
  'info',
  'warning',
  'critical',
  'breach',
];
