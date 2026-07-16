/**
 * Token anomaly monitor: velocity, UA/network drift, failed auth, scope violations.
 * High-risk anomalies can suspend the token until cleared.
 */

import {
  getTokenBaseline,
  learnTokenBaseline,
  suspendToken,
} from './client-approval-store.js';
import { recordSecuritySignal } from './security-alerting.js';
import { appendSecurityAudit } from './security-audit.js';
import type { ClientFingerprintParts } from './client-fingerprint.js';

const VELOCITY_WINDOW_MS = 60_000;
const VELOCITY_DEFAULT = 120;
const velocity = new Map<string, number[]>();

export interface TokenAnomalyResult {
  blocked: boolean;
  reasons: string[];
  suspended: boolean;
  code?: string;
  message?: string;
}

function checkVelocity(tokenId: string, limit = VELOCITY_DEFAULT): {
  count: number;
  limit: number;
  exceeded: boolean;
} {
  const now = Date.now();
  const times = velocity.get(tokenId) ?? [];
  times.push(now);
  const cutoff = now - VELOCITY_WINDOW_MS;
  const trimmed = times.filter((t) => t >= cutoff);
  velocity.set(tokenId, trimmed);
  return { count: trimmed.length, limit, exceeded: trimmed.length > limit };
}

export async function monitorTokenRequest(input: {
  tokenId: string;
  tenantId: string;
  fingerprint: ClientFingerprintParts;
  rateLimitRpm?: number;
  autoSuspend?: boolean;
}): Promise<TokenAnomalyResult> {
  const reasons: string[] = [];
  const limit = input.rateLimitRpm && input.rateLimitRpm > 0
    ? input.rateLimitRpm
    : VELOCITY_DEFAULT;
  const vel = checkVelocity(input.tokenId, limit);
  if (vel.exceeded) {
    reasons.push(`Rate limit exceeded: ${vel.count} requests/min (limit ${vel.limit})`);
    recordSecuritySignal('token_velocity', input.tokenId, {
      count: vel.count,
      limit: vel.limit,
      tenantId: input.tenantId,
    });
  }

  const baseline = await getTokenBaseline(input.tokenId).catch(() => ({
    knownUaHashes: [] as string[],
    knownIpHashes: [] as string[],
  }));

  const knownUa = new Set(baseline.knownUaHashes);
  const knownIp = new Set(baseline.knownIpHashes);
  const hasBaseline = knownUa.size > 0 || knownIp.size > 0;

  if (hasBaseline) {
    if (input.fingerprint.uaHash && !knownUa.has(input.fingerprint.uaHash)) {
      reasons.push(`New user-agent pattern (${input.fingerprint.uaSummary})`);
      recordSecuritySignal('ua_change', input.tokenId, {
        uaSummary: input.fingerprint.uaSummary,
        tenantId: input.tenantId,
      });
    }
    if (input.fingerprint.ipHash && !knownIp.has(input.fingerprint.ipHash) && knownIp.size > 0) {
      // Soft signal only; do not auto-block solely on IP change (mobile/roaming).
      appendSecurityAudit({
        category: 'token_anomaly',
        action: 'ip_change_observed',
        detail: 'Token used from a new IP hash',
        metadata: { tokenId: input.tokenId, tenantId: input.tenantId },
      });
    }
  } else {
    await learnTokenBaseline(input.tokenId, input.fingerprint).catch(() => {});
  }

  const highRisk = vel.exceeded;
  const autoSuspend = input.autoSuspend !== false;
  if (highRisk && autoSuspend) {
    await suspendToken(
      input.tokenId,
      reasons.join('; ') || 'Automatic suspension after token anomaly',
      new Date(Date.now() + 60 * 60_000),
    ).catch(() => {});
    return {
      blocked: true,
      suspended: true,
      reasons,
      code: 'TOKEN_SUSPENDED',
      message: 'Token temporarily suspended due to suspicious request rate.',
    };
  }

  // UA change alone alerts but does not block once a pending approval gate exists.
  return { blocked: false, suspended: false, reasons };
}

export function recordFailedAuth(subjectKey: string, metadata?: Record<string, unknown>): void {
  recordSecuritySignal('failed_auth', subjectKey, metadata);
}

export function recordScopeViolation(tokenId: string, scope: string): void {
  recordSecuritySignal('scope_violation', tokenId, { scope });
  appendSecurityAudit({
    category: 'token_anomaly',
    action: 'scope_violation',
    detail: `Scope '${scope}' denied`,
    metadata: { tokenId, scope },
  });
}

export function recordPendingClientBurst(tenantId: string): void {
  recordSecuritySignal('device_abuse', tenantId);
}

/** Test helper */
export function _resetTokenVelocityForTests(): void {
  velocity.clear();
}
