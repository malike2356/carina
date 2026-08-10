/**
 * Session security tiers and runtime config.
 */

export type SessionTier = 'financial' | 'business' | 'content';

export type ConcurrentLimitPolicy = 'kill_oldest' | 'block_new';

export type SessionConfig = {
  tier: SessionTier;
  idleTimeoutMs: number;
  absoluteMaxMs: number;
  maxConcurrent: number;
  onLimit: ConcurrentLimitPolicy;
  project?: string;
};

export const TIER_DEFAULTS: Record<SessionTier, Omit<SessionConfig, 'tier' | 'project'>> = {
  financial: {
    idleTimeoutMs: 4 * 60 * 60 * 1000,
    absoluteMaxMs: 12 * 60 * 60 * 1000,
    maxConcurrent: 5,
    onLimit: 'kill_oldest',
  },
  business: {
    idleTimeoutMs: 2 * 60 * 60 * 1000,
    absoluteMaxMs: 24 * 60 * 60 * 1000,
    maxConcurrent: 5,
    onLimit: 'kill_oldest',
  },
  content: {
    idleTimeoutMs: 24 * 60 * 60 * 1000,
    absoluteMaxMs: 7 * 24 * 60 * 60 * 1000,
    maxConcurrent: 5,
    onLimit: 'kill_oldest',
  },
};

export function resolveSessionConfig(input?: {
  tier?: SessionTier | string;
  idleTimeoutMs?: number;
  absoluteMaxMs?: number;
  maxConcurrent?: number;
  onLimit?: ConcurrentLimitPolicy | string;
  project?: string;
  env?: NodeJS.ProcessEnv;
}): SessionConfig {
  const env = input?.env ?? process.env;
  const tierRaw = String(input?.tier ?? env.SESSION_TIER ?? env.CARINA_SESSION_TIER ?? env.KEPRIX_SESSION_TIER ?? 'business')
    .trim()
    .toLowerCase();
  const tier: SessionTier =
    tierRaw === 'financial' || tierRaw === 'content' || tierRaw === 'business' ? tierRaw : 'business';
  const base = TIER_DEFAULTS[tier];
  const idleTimeoutMs = Number(input?.idleTimeoutMs ?? env.SESSION_IDLE_TIMEOUT_MS ?? base.idleTimeoutMs);
  const absoluteMaxMs = Number(input?.absoluteMaxMs ?? env.SESSION_ABSOLUTE_MAX_MS ?? base.absoluteMaxMs);
  const maxConcurrent = Number(input?.maxConcurrent ?? env.SESSION_MAX_CONCURRENT ?? base.maxConcurrent);
  const onLimitRaw = String(input?.onLimit ?? env.SESSION_ON_LIMIT ?? base.onLimit).trim().toLowerCase();
  const onLimit: ConcurrentLimitPolicy = onLimitRaw === 'block_new' ? 'block_new' : 'kill_oldest';
  return {
    tier,
    idleTimeoutMs: Number.isFinite(idleTimeoutMs) && idleTimeoutMs > 0 ? idleTimeoutMs : base.idleTimeoutMs,
    absoluteMaxMs: Number.isFinite(absoluteMaxMs) && absoluteMaxMs > 0 ? absoluteMaxMs : base.absoluteMaxMs,
    maxConcurrent: Number.isFinite(maxConcurrent) && maxConcurrent > 0 ? Math.floor(maxConcurrent) : 5,
    onLimit,
    project: input?.project ?? env.SESSION_PROJECT ?? undefined,
  };
}

export type DeviceInfo = {
  userAgent?: string | null;
  ip?: string | null;
  deviceLabel?: string | null;
  location?: string | null;
  browser?: string | null;
  os?: string | null;
};

export type AuthSession = {
  sessionId: string;
  userId: string;
  createdAt: string;
  lastActiveAt: string;
  absoluteExpiresAt: string;
  idleExpiresAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
  device: DeviceInfo;
  project: string | null;
};

export type ValidationResult =
  | { ok: true; session: AuthSession }
  | { ok: false; reason: 'missing' | 'revoked' | 'idle_expired' | 'absolute_expired' | 'over_limit' };

export type RevocationReason =
  | 'password_changed'
  | 'security_incident'
  | 'user_request'
  | 'role_changed'
  | 'concurrent_limit'
  | 'admin'
  | 'logout';

export type RevocationLogEntry = {
  id: string;
  timestamp: string;
  userId: string;
  sessionId: string | null;
  reason: RevocationReason | string;
  initiatedBy: 'user' | 'system' | 'admin' | string;
  meta?: Record<string, string | number | boolean | null>;
};

export type NewDeviceLoginEvent = {
  userId: string;
  sessionId: string;
  browser: string;
  os: string;
  location: string;
  ip: string | null;
  createdAt: string;
};
