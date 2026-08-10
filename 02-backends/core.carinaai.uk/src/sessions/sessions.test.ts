/**
 * Session expiration, concurrent limits, and revocation tests.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  MemorySessionStore,
  SessionManager,
  clearProjectLimitsForTests,
  formatNewLoginMessage,
  getRevocationLog,
  resolveSessionConfig,
  revokeOnPasswordChange,
  setMaxConcurrent,
} from './index.js';

describe('session expiration limits and revocation', () => {
  beforeEach(() => {
    clearProjectLimitsForTests();
  });

  it('expires on idle and absolute lifetime', () => {
    let now = Date.parse('2026-08-10T00:00:00.000Z');
    const store = new MemorySessionStore();
    const manager = new SessionManager({
      store,
      config: resolveSessionConfig({
        tier: 'business',
        idleTimeoutMs: 60_000,
        absoluteMaxMs: 120_000,
        maxConcurrent: 5,
      }),
      now: () => now,
    });
    const created = manager.createSession('user-1', { userAgent: 'Chrome/120 Windows', ip: '1.1.1.1' });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('create failed');
    now += 30_000;
    expect(manager.validateSession(created.session.sessionId, { touch: false }).ok).toBe(true);
    now += 40_000;
    const idle = manager.validateSession(created.session.sessionId, { touch: false });
    expect(idle.ok).toBe(false);
    if (idle.ok) throw new Error('expected idle fail');
    expect(idle.reason).toBe('idle_expired');

    const created2 = manager.createSession('user-1', { userAgent: 'Firefox/120 Linux', ip: '2.2.2.2' });
    expect(created2.ok).toBe(true);
    if (!created2.ok) throw new Error('create2 failed');
    now = Date.parse(created2.session.createdAt) + 130_000;
    const abs = manager.validateSession(created2.session.sessionId, { touch: false });
    expect(abs.ok).toBe(false);
    if (abs.ok) throw new Error('expected absolute fail');
    expect(abs.reason).toBe('absolute_expired');
  });

  it('kills oldest when concurrent limit is hit, then password revoke clears all', async () => {
    const emails: string[] = [];
    const store = new MemorySessionStore();
    setMaxConcurrent('demo', 5);
    const manager = new SessionManager({
      store,
      config: resolveSessionConfig({
        tier: 'content',
        maxConcurrent: 5,
        onLimit: 'kill_oldest',
        project: 'demo',
        idleTimeoutMs: 24 * 60 * 60 * 1000,
        absoluteMaxMs: 7 * 24 * 60 * 60 * 1000,
      }),
      onNewDeviceLogin: async (_event, message) => {
        emails.push(message);
      },
    });

    const ids: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      const result = manager.createSession('user-a', {
        userAgent: `Chrome/${100 + i} Windows`,
        ip: `10.0.0.${i + 1}`,
        location: i === 0 ? 'Berlin, DE' : `City-${i}`,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('expected ok');
      ids.push(result.session.sessionId);
      if (i === 5) {
        expect(result.killedSessionIds.length).toBeGreaterThanOrEqual(1);
        expect(result.killedSessionIds).toContain(ids[0]);
      }
    }

    const active = manager.getUserSessions('user-a');
    expect(active).toHaveLength(5);
    expect(store.get(ids[0])?.revokedAt).toBeTruthy();

    expect(emails[0]).toContain('New sign-in');
    expect(emails[0]).toMatch(/Berlin|City-/);

    const revoked = revokeOnPasswordChange(store, 'user-a');
    expect(revoked.count).toBe(5);
    expect(manager.getUserSessions('user-a')).toHaveLength(0);
    const log = getRevocationLog(store, { userId: 'user-a' });
    expect(log.some((r) => r.reason === 'password_changed')).toBe(true);
    expect(log.some((r) => r.reason === 'concurrent_limit')).toBe(true);
  });

  it('formats new login message and resolves tiers from env', () => {
    expect(formatNewLoginMessage({ browser: 'Chrome', os: 'Windows', location: 'Berlin, DE' })).toBe(
      'New sign-in from Chrome on Windows in Berlin, DE',
    );
    const financial = resolveSessionConfig({ tier: 'financial' });
    expect(financial.idleTimeoutMs).toBe(4 * 60 * 60 * 1000);
    expect(financial.absoluteMaxMs).toBe(12 * 60 * 60 * 1000);
  });
});
