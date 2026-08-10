/**
 * Core auth session manager: create, validate, list, touch.
 */
import { randomUUID } from 'node:crypto';
import { enforceConcurrentLimit, getConcurrentCount } from './concurrent-limiter.js';
import { parseDeviceInfo, formatNewLoginMessage } from './device-info.js';
import { revokeSession } from './revocation.js';
import { getDefaultSessionStore, type SessionStore } from './session-store.js';
import {
  resolveSessionConfig,
  type AuthSession,
  type DeviceInfo,
  type NewDeviceLoginEvent,
  type SessionConfig,
  type ValidationResult,
} from './types.js';

export type SessionManagerOptions = {
  store?: SessionStore;
  config?: SessionConfig;
  onNewDeviceLogin?: (event: NewDeviceLoginEvent, message: string) => void | Promise<void>;
  now?: () => number;
};

function isKnownDevice(existing: AuthSession[], device: DeviceInfo): boolean {
  const label = (device.deviceLabel || '').toLowerCase();
  const ip = device.ip || '';
  return existing.some((s) => {
    if (s.revokedAt) return false;
    const sameLabel = (s.device.deviceLabel || '').toLowerCase() === label && Boolean(label);
    const sameIp = Boolean(ip) && s.device.ip === ip;
    return sameLabel || sameIp;
  });
}

export class SessionManager {
  readonly store: SessionStore;
  readonly config: SessionConfig;
  private onNewDeviceLogin?: SessionManagerOptions['onNewDeviceLogin'];
  private now: () => number;

  constructor(options: SessionManagerOptions = {}) {
    this.store = options.store ?? getDefaultSessionStore();
    this.config = options.config ?? resolveSessionConfig();
    this.onNewDeviceLogin = options.onNewDeviceLogin;
    this.now = options.now ?? (() => Date.now());
  }

  createSession(
    userId: string,
    deviceInfo: Partial<DeviceInfo> & { userAgent?: string | null; ip?: string | null } = {},
  ): { ok: true; session: AuthSession; killedSessionIds: string[] } | { ok: false; error: string } {
    const device = parseDeviceInfo(deviceInfo);
    const active = this.store.listByUser(userId).filter((s) => !s.revokedAt);
    const limit = enforceConcurrentLimit(active, this.config);
    if (!limit.allowed) {
      return { ok: false, error: 'Too many active sessions; log out another device first' };
    }
    for (const id of limit.killedSessionIds) {
      revokeSession(this.store, id, 'concurrent_limit', 'system');
    }

    const ts = this.now();
    const session: AuthSession = {
      sessionId: randomUUID(),
      userId,
      createdAt: new Date(ts).toISOString(),
      lastActiveAt: new Date(ts).toISOString(),
      absoluteExpiresAt: new Date(ts + this.config.absoluteMaxMs).toISOString(),
      idleExpiresAt: new Date(ts + this.config.idleTimeoutMs).toISOString(),
      revokedAt: null,
      revokeReason: null,
      device,
      project: this.config.project ?? null,
    };
    this.store.save(session);

    if (!isKnownDevice(active, device)) {
      const event: NewDeviceLoginEvent = {
        userId,
        sessionId: session.sessionId,
        browser: device.browser || 'Unknown browser',
        os: device.os || 'Unknown OS',
        location: device.location || 'Unknown location',
        ip: device.ip ?? null,
        createdAt: session.createdAt,
      };
      const message = formatNewLoginMessage(event);
      void Promise.resolve(this.onNewDeviceLogin?.(event, message)).catch(() => undefined);
    }

    return { ok: true, session, killedSessionIds: limit.killedSessionIds };
  }

  validateSession(sessionId: string, opts?: { touch?: boolean }): ValidationResult {
    const session = this.store.get(sessionId);
    if (!session) return { ok: false, reason: 'missing' };
    if (session.revokedAt) return { ok: false, reason: 'revoked' };
    const ts = this.now();
    if (Date.parse(session.absoluteExpiresAt) <= ts) {
      this.store.markRevoked(sessionId, 'absolute_expired');
      return { ok: false, reason: 'absolute_expired' };
    }
    if (Date.parse(session.idleExpiresAt) <= ts) {
      this.store.markRevoked(sessionId, 'idle_expired');
      return { ok: false, reason: 'idle_expired' };
    }
    if (opts?.touch !== false) {
      return { ok: true, session: this.touchSession(sessionId) ?? session };
    }
    return { ok: true, session };
  }

  touchSession(sessionId: string): AuthSession | null {
    const session = this.store.get(sessionId);
    if (!session || session.revokedAt) return null;
    const ts = this.now();
    if (Date.parse(session.absoluteExpiresAt) <= ts) return null;
    const updated: AuthSession = {
      ...session,
      lastActiveAt: new Date(ts).toISOString(),
      idleExpiresAt: new Date(ts + this.config.idleTimeoutMs).toISOString(),
    };
    this.store.save(updated);
    return updated;
  }

  getUserSessions(userId: string, opts?: { includeRevoked?: boolean }): AuthSession[] {
    const rows = this.store.listByUser(userId);
    if (opts?.includeRevoked) return rows;
    return rows.filter((s) => !s.revokedAt);
  }

  getConcurrentCount(userId: string): number {
    return getConcurrentCount(this.getUserSessions(userId));
  }
}

export function createSessionManager(options?: SessionManagerOptions): SessionManager {
  return new SessionManager(options);
}
