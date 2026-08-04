/**
 * Security alert thresholds with suppression to avoid alert floods.
 */

import { appendSecurityAudit } from './security-audit.js';

export type SecurityAlertType =
  | 'failed_auth'
  | 'scope_violation'
  | 'token_velocity'
  | 'ua_change'
  | 'device_abuse';

const THRESHOLDS: Record<SecurityAlertType, { count: number; windowMs: number; label: string }> = {
  failed_auth: { count: 5, windowMs: 5 * 60_000, label: 'failed auth attempts' },
  scope_violation: { count: 3, windowMs: 60_000, label: 'scope violations' },
  token_velocity: { count: 1, windowMs: 60_000, label: 'token velocity breaches' },
  ua_change: { count: 1, windowMs: 60_000, label: 'user-agent changes' },
  device_abuse: { count: 10, windowMs: 10 * 60_000, label: 'pending client requests' },
};

const SUPPRESSION_WINDOW_MS = 15 * 60_000;

const trackers = new Map<string, number[]>();
const suppressionMap = new Map<string, number>();

function prune(key: string, windowMs: number): number[] {
  const cutoff = Date.now() - windowMs;
  const fresh = (trackers.get(key) ?? []).filter((t) => t > cutoff);
  if (fresh.length === 0) trackers.delete(key);
  else trackers.set(key, fresh);
  return fresh;
}

function isSuppressed(suppressKey: string): boolean {
  const last = suppressionMap.get(suppressKey);
  return Boolean(last && Date.now() - last < SUPPRESSION_WINDOW_MS);
}

export interface SecurityAlertResult {
  fired: boolean;
  suppressed: boolean;
  count: number;
  threshold: number;
}

/**
 * Record a security signal. Returns whether an alert fired (and was not suppressed).
 */
export function recordSecuritySignal(
  type: SecurityAlertType,
  subjectKey: string,
  metadata?: Record<string, unknown>,
): SecurityAlertResult {
  const cfg = THRESHOLDS[type];
  const key = `${type}:${subjectKey}`;
  const times = prune(key, cfg.windowMs);
  times.push(Date.now());
  trackers.set(key, times);
  const count = times.length;
  if (count < cfg.count) {
    return { fired: false, suppressed: false, count, threshold: cfg.count };
  }

  const suppressKey = key;
  if (isSuppressed(suppressKey)) {
    return { fired: false, suppressed: true, count, threshold: cfg.count };
  }
  suppressionMap.set(suppressKey, Date.now());
  appendSecurityAudit({
    category: 'token_anomaly',
    action: `alert_${type}`,
    detail: `${count} ${cfg.label} for ${subjectKey}`,
    metadata: { type, subjectKey, count, ...(metadata ?? {}) },
  });
  if (process.env.SECURITY_ALERT_EMAIL || process.env.ADMIN_EMAIL) {
    console.warn(
      `[security-alert] ${count} ${cfg.label} for ${subjectKey}`,
      metadata ?? {},
    );
  }
  return { fired: true, suppressed: false, count, threshold: cfg.count };
}

/** Test helper */
export function _resetSecurityAlertingForTests(): void {
  trackers.clear();
  suppressionMap.clear();
}
