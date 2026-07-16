import { config } from '../config/index.js';
import { reportEvent } from './scout-client.js';
import { appendSecurityAudit, type SecurityAuditCategory } from './security-audit.js';

export type CriticalSecurityEventInput = {
  category: SecurityAuditCategory;
  action: string;
  detail: string;
  sessionId?: string;
  toolName?: string;
  severity?: 'info' | 'warning' | 'critical' | 'breach';
  metadata?: Record<string, unknown>;
};

function eventType(input: CriticalSecurityEventInput): string {
  return `${input.category}_${input.action}`.replace(/[^a-z0-9_]+/gi, '_').toLowerCase();
}

export async function attestCriticalSecurityEvent(input: CriticalSecurityEventInput): Promise<void> {
  const audit = appendSecurityAudit({
    category: input.category,
    action: input.action,
    detail: input.detail,
    sessionId: input.sessionId,
    toolName: input.toolName,
    metadata: {
      ...(input.metadata ?? {}),
      attestationRequested: true,
    },
  });

  await reportEvent({
    severity: input.severity ?? 'warning',
    source: 'carina-core',
    event_type: eventType(input),
    description: input.detail,
    session_id: input.sessionId,
    instance_id: config.labyrinth.instanceId,
    metadata: {
      ...(input.metadata ?? {}),
      category: input.category,
      action: input.action,
      toolName: input.toolName ?? null,
      auditAt: audit.at,
    },
  });
}
