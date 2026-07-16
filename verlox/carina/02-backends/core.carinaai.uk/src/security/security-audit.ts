import fs from 'node:fs';
import path from 'node:path';
import { CARINA_HOME } from '../config/paths.js';

export type SecurityAuditCategory =
  | 'tool_rbac'
  | 'tool_policy'
  | 'sandbox_policy'
  | 'scout_policy'
  | 'kill_switch'
  | 'attestation'
  | 'prompt_injection'
  | 'connector_scope'
  | 'client_approval'
  | 'token_anomaly';

export type SecurityAuditEvent = {
  at: string;
  category: SecurityAuditCategory;
  action: string;
  detail: string;
  sessionId?: string;
  toolName?: string;
  metadata?: Record<string, unknown>;
};

const AUDIT_FILE = () => path.join(CARINA_HOME, 'security-audit.jsonl');

export function appendSecurityAudit(
  event: Omit<SecurityAuditEvent, 'at'>,
): SecurityAuditEvent {
  const row: SecurityAuditEvent = { ...event, at: new Date().toISOString() };
  try {
    fs.mkdirSync(CARINA_HOME, { recursive: true });
    fs.appendFileSync(AUDIT_FILE(), `${JSON.stringify(row)}\n`, 'utf8');
  } catch {
    // audit must not block enforcement
  }
  return row;
}

export function readSecurityAuditTail(limit = 50): SecurityAuditEvent[] {
  try {
    const raw = fs.readFileSync(AUDIT_FILE(), 'utf8');
    const lines = raw.trim().split('\n').filter(Boolean);
    return lines.slice(-limit).map((line) => JSON.parse(line) as SecurityAuditEvent);
  } catch {
    return [];
  }
}

export function searchSecurityAudit(options: {
  category?: SecurityAuditCategory;
  action?: string;
  limit?: number;
} = {}): SecurityAuditEvent[] {
  const limit = Math.min(500, Math.max(1, options.limit ?? 50));
  let rows = readSecurityAuditTail(500);
  if (options.category) {
    rows = rows.filter((row) => row.category === options.category);
  }
  if (options.action) {
    rows = rows.filter((row) => row.action === options.action);
  }
  return rows.slice(-limit);
}

export function _resetSecurityAuditForTests(): void {
  try {
    fs.unlinkSync(AUDIT_FILE());
  } catch {
    // ignore
  }
}
