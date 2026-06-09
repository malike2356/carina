import type { AuditEventType } from '../audit-schemas.js';

/**
 * Retention policies per spec lines 141-149.
 *
 * Each policy defines the maximum age of audit log rows for a given
 * event_type before they are eligible for deletion. The scheduled
 * retention job in audit-retention.ts applies these windows.
 *
 * audit_log rows of type 'admin' are kept for 2 years (730 days);
 * this is the longest window because admin actions include compliance
 * requests, kill-switch events, and configuration changes that must
 * be preserved for legal and operational audits.
 *
 * Rows with event_type 'security' are kept for 365 days along with
 * 'auth' rows (also 365 days) to support security investigations.
 *
 * High-volume operational rows (tool_execution, model_request) are
 * kept for 90 days; sufficient for debugging and cost analysis
 * without excessive storage.
 */

export interface RetentionPolicy {
  event_type: AuditEventType;
  retention_days: number;
}

export const RETENTION_POLICIES: RetentionPolicy[] = [
  { event_type: 'tool_execution', retention_days: 90 },
  { event_type: 'model_request', retention_days: 90 },
  { event_type: 'security', retention_days: 365 },
  { event_type: 'admin', retention_days: 730 },
  { event_type: 'auth', retention_days: 365 },
];

/**
 * Lookup table for fast O(1) access by event_type.
 */
export const RETENTION_MAP: Record<string, number> = Object.fromEntries(
  RETENTION_POLICIES.map((p) => [p.event_type, p.retention_days]),
);
