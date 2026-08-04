/**
 * Auth hardening helpers that extend auth-rate-limit.ts (brute-force lockout)
 * with three additional layers:
 *  - audit logging for login/logout/signup (via security-audit.ts)
 *  - suspicious login detection (new IP for a known user)
 *  - session revocation on password change (session version bump)
 *
 * Redis is used when available (multi-instance safe); every function
 * degrades to a local in-memory fallback so auth still works without Redis
 * in local dev and tests.
 */
import { getRedis } from '../memory/redis.js';
import { appendSecurityAudit } from './security-audit.js';

export type AuthAuditAction =
  | 'login_success'
  | 'login_failed'
  | 'login_blocked'
  | 'logout'
  | 'signup'
  | 'password_reset_requested'
  | 'password_reset_completed';

export function recordAuthAuditEvent(params: {
  action: AuthAuditAction;
  detail: string;
  userId?: string;
  email?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
}): void {
  appendSecurityAudit({
    category: 'auth',
    action: params.action,
    detail: params.detail,
    metadata: {
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.email ? { email: params.email } : {}),
      ...(params.ip ? { ip: params.ip } : {}),
      ...(params.metadata ?? {}),
    },
  });
}

const SUSPICIOUS_TTL_SECONDS = 60 * 60;
const LAST_IP_TTL_SECONDS = 90 * 24 * 60 * 60;

const memoryLastIp = new Map<string, string>();
const memorySuspicious = new Map<string, { previousIp: string; newIp: string; userAgent: string; at: string }>();

export interface SuspiciousLoginInfo {
  previousIp: string;
  newIp: string;
  userAgent: string;
  at: string;
}

/**
 * Records the login IP for a user and returns suspicious-login details when
 * this login comes from a different IP than the last known one. First login
 * ever for a user is never flagged.
 */
export async function checkSuspiciousLogin(
  userId: string,
  ip: string,
  userAgent: string,
): Promise<SuspiciousLoginInfo | null> {
  if (!userId || !ip) return null;
  const redis = getRedis();
  const lastIpKey = `carina:auth:last_ip:${userId}`;

  let previousIp: string | null = null;
  if (redis) {
    try {
      previousIp = await redis.get(lastIpKey);
      await redis.set(lastIpKey, ip, 'EX', LAST_IP_TTL_SECONDS);
    } catch {
      previousIp = memoryLastIp.get(userId) ?? null;
      memoryLastIp.set(userId, ip);
    }
  } else {
    previousIp = memoryLastIp.get(userId) ?? null;
    memoryLastIp.set(userId, ip);
  }

  if (!previousIp || previousIp === ip) return null;

  const info: SuspiciousLoginInfo = {
    previousIp,
    newIp: ip,
    userAgent,
    at: new Date().toISOString(),
  };

  const suspiciousKey = `carina:auth:suspicious:${userId}`;
  if (redis) {
    try {
      await redis.set(suspiciousKey, JSON.stringify(info), 'EX', SUSPICIOUS_TTL_SECONDS);
    } catch {
      memorySuspicious.set(userId, info);
    }
  } else {
    memorySuspicious.set(userId, info);
  }

  recordAuthAuditEvent({
    action: 'login_success',
    detail: 'suspicious login: new IP for known user',
    userId,
    ip,
    metadata: { previousIp, userAgent },
  });

  return info;
}

/** Session-version counter used to force-revoke sessions on password change. */
const memorySessionVersions = new Map<string, number>();

export async function getSessionVersion(userId: string): Promise<number> {
  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.get(`carina:auth:session_version:${userId}`);
      return raw ? Number(raw) || 0 : 0;
    } catch {
      // fall through to memory
    }
  }
  return memorySessionVersions.get(userId) ?? 0;
}

/** Call when a user's password changes to invalidate all of their existing sessions. */
export async function bumpSessionVersion(userId: string): Promise<number> {
  const redis = getRedis();
  if (redis) {
    try {
      const next = await redis.incr(`carina:auth:session_version:${userId}`);
      return next;
    } catch {
      // fall through to memory
    }
  }
  const next = (memorySessionVersions.get(userId) ?? 0) + 1;
  memorySessionVersions.set(userId, next);
  return next;
}

/** Reset in-memory state (tests only). */
export function _resetAuthHardeningForTests(): void {
  memoryLastIp.clear();
  memorySuspicious.clear();
  memorySessionVersions.clear();
}
