import { describe, it, expect, vi, beforeEach } from 'vitest';

const clearSessionMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../memory/store.js', () => ({
  clearSession: (...args: unknown[]) => clearSessionMock(...args),
}));

vi.mock('../config/index.js', () => ({
  config: {
    labyrinth: {
      enabled: true,
      instanceId: 'test-001',
      instanceName: 'Test',
    },
    redis: { url: 'redis://localhost:6379' },
  },
}));

describe('kill-switch-listener', () => {
  beforeEach(async () => {
    delete process.env.SCOUT_CONTROL_MODE;
    delete process.env.LABYRINTH_CONTROL_MODE;
    delete process.env.SCOUT_ENFORCEMENT_ENABLED;
    delete process.env.LABYRINTH_ENFORCEMENT_ENABLED;
    clearSessionMock.mockClear();
    const mod = await import('./kill-switch-listener.js');
    mod._resetSuspendedFlag();
    mod._clearBlockedSessions();
    mod._clearQuarantinedTools();
    mod._clearOperatorBlockedDomains();
    mod._resetRateLimits();
  });

  it('checkNotSuspended does not throw before suspend command', async () => {
    const { checkNotSuspended } = await import('./kill-switch-listener.js');
    expect(() => checkNotSuspended()).not.toThrow();
  });

  it('checkNotSuspended throws after suspend message', async () => {
    const { checkNotSuspended, _processControlMessage } = await import('./kill-switch-listener.js');
    _processControlMessage(
      JSON.stringify({ action: 'suspend', instance_id: 'test-001', reason: 'test' }),
    );
    expect(() => checkNotSuspended()).toThrow(/suspended by Labyrinth Scout/);
  });

  it('checkNotSuspended returns normally after resume message', async () => {
    const { checkNotSuspended, _processControlMessage } = await import('./kill-switch-listener.js');
    _processControlMessage(
      JSON.stringify({ action: 'suspend', instance_id: 'test-001', reason: 'test' }),
    );
    _processControlMessage(JSON.stringify({ action: 'resume', instance_id: 'test-001' }));
    expect(() => checkNotSuspended()).not.toThrow();
  });

  it('does not suspend the instance in monitor mode', async () => {
    process.env.SCOUT_CONTROL_MODE = 'monitor';
    const { checkNotSuspended, getKillSwitchStatus, _processControlMessage } =
      await import('./kill-switch-listener.js');
    _processControlMessage(
      JSON.stringify({ action: 'suspend', instance_id: 'test-001', reason: 'test' }),
    );
    expect(() => checkNotSuspended()).not.toThrow();
    expect(getKillSwitchStatus().active).toBe(false);
  });

  it('ignores messages for other instances', async () => {
    const { checkNotSuspended, _processControlMessage } = await import('./kill-switch-listener.js');
    _processControlMessage(
      JSON.stringify({ action: 'suspend', instance_id: 'other-instance', reason: 'test' }),
    );
    expect(() => checkNotSuspended()).not.toThrow();
  });

  it('initKillSwitchListener returns no-op cleanup when disabled', async () => {
    vi.doMock('../config/index.js', () => ({
      config: {
        labyrinth: { enabled: false, instanceId: 'test-001', instanceName: 'Test' },
        redis: { url: 'redis://localhost:6379' },
      },
    }));
    vi.resetModules();
    const { initKillSwitchListener } = await import('./kill-switch-listener.js');
    const cleanup = initKillSwitchListener();
    expect(typeof cleanup).toBe('function');
    expect(() => cleanup()).not.toThrow();
  });

  it('block_session message blocks the target session', async () => {
    const { isSessionBlocked, _processControlMessage, _clearBlockedSessions } =
      await import('./kill-switch-listener.js');
    _processControlMessage(
      JSON.stringify({
        action: 'block_session',
        session_id: 's-001',
        instance_id: 'test-001',
        reason: 'test',
      }),
    );
    expect(isSessionBlocked('s-001')).toBe(true);
    expect(isSessionBlocked('s-002')).toBe(false);
    _clearBlockedSessions();
    expect(isSessionBlocked('s-001')).toBe(false);
  });

  it('block_session does not block unrelated sessions', async () => {
    const { isSessionBlocked, _processControlMessage } = await import('./kill-switch-listener.js');
    _processControlMessage(
      JSON.stringify({
        action: 'block_session',
        session_id: 'session-A',
        instance_id: 'test-001',
        reason: 'test',
      }),
    );
    expect(isSessionBlocked('session-A')).toBe(true);
    expect(isSessionBlocked('session-B')).toBe(false);
  });

  it('does not block sessions in monitor mode', async () => {
    process.env.SCOUT_CONTROL_MODE = 'monitor';
    const { isSessionBlocked, _processControlMessage } = await import('./kill-switch-listener.js');
    _processControlMessage(
      JSON.stringify({
        action: 'block_session',
        session_id: 'session-A',
        instance_id: 'test-001',
        reason: 'test',
      }),
    );
    expect(isSessionBlocked('session-A')).toBe(false);
  });

  it('quarantine_tool marks tool as quarantined', async () => {
    const { isToolQuarantined, _processControlMessage } = await import('./kill-switch-listener.js');
    _processControlMessage(
      JSON.stringify({
        action: 'quarantine_tool',
        tool: 'shell-exec',
        instance_id: 'test-001',
        reason: 'test',
      }),
    );
    expect(isToolQuarantined('test-001', 'shell-exec')).toBe(true);
    expect(isToolQuarantined('test-001', 'file-read')).toBe(false);
  });

  it('lift_quarantine clears quarantine state', async () => {
    const { isToolQuarantined, _processControlMessage } = await import('./kill-switch-listener.js');
    _processControlMessage(
      JSON.stringify({
        action: 'quarantine_tool',
        tool: 'shell-exec',
        instance_id: 'test-001',
        reason: 'test',
      }),
    );
    _processControlMessage(
      JSON.stringify({
        action: 'lift_quarantine',
        tool: 'shell-exec',
        instance_id: 'test-001',
      }),
    );
    expect(isToolQuarantined('test-001', 'shell-exec')).toBe(false);
  });

  it('block_egress marks domain as blocked', async () => {
    const { isOperatorBlocked, _processControlMessage } = await import('./kill-switch-listener.js');
    _processControlMessage(
      JSON.stringify({
        action: 'block_egress',
        domain: 'evil.com',
        instance_id: 'test-001',
        reason: 'test',
      }),
    );
    expect(isOperatorBlocked('test-001', 'evil.com')).toBe(true);
    expect(isOperatorBlocked('test-001', 'safe.com')).toBe(false);
  });

  it('unblock_egress clears domain block', async () => {
    const { isOperatorBlocked, _processControlMessage } = await import('./kill-switch-listener.js');
    _processControlMessage(
      JSON.stringify({
        action: 'block_egress',
        domain: 'evil.com',
        instance_id: 'test-001',
        reason: 'test',
      }),
    );
    _processControlMessage(
      JSON.stringify({
        action: 'unblock_egress',
        domain: 'evil.com',
        instance_id: 'test-001',
      }),
    );
    expect(isOperatorBlocked('test-001', 'evil.com')).toBe(false);
  });

  it('block_egress matching is case-insensitive', async () => {
    const { isOperatorBlocked, _processControlMessage } = await import('./kill-switch-listener.js');
    _processControlMessage(
      JSON.stringify({
        action: 'block_egress',
        domain: 'Evil.COM',
        instance_id: 'test-001',
        reason: 'test',
      }),
    );
    expect(isOperatorBlocked('test-001', 'evil.com')).toBe(true);
  });

  it('set_rate_limit stores per-session override', async () => {
    const { getSessionRateLimit, _processControlMessage } = await import('./kill-switch-listener.js');
    _processControlMessage(
      JSON.stringify({
        action: 'set_rate_limit',
        session_id: 'abc123',
        instance_id: 'test-001',
        calls_per_minute: 3,
        reason: 'test',
      }),
    );
    expect(getSessionRateLimit('abc123')).toBe(3);
  });

  it('clear_rate_limit removes session override', async () => {
    const { getSessionRateLimit, _processControlMessage } = await import('./kill-switch-listener.js');
    _processControlMessage(
      JSON.stringify({
        action: 'set_rate_limit',
        session_id: 'abc123',
        instance_id: 'test-001',
        calls_per_minute: 3,
        reason: 'test',
      }),
    );
    _processControlMessage(
      JSON.stringify({
        action: 'clear_rate_limit',
        session_id: 'abc123',
        instance_id: 'test-001',
      }),
    );
    expect(getSessionRateLimit('abc123')).toBeNull();
  });

  it('clear_session_memory calls clearSession for matching instance', async () => {
    const { _processControlMessage } = await import('./kill-switch-listener.js');
    _processControlMessage(
      JSON.stringify({
        action: 'clear_session_memory',
        session_id: 'abc123',
        instance_id: 'test-001',
        reason: 'test',
      }),
    );
    await vi.waitFor(() => {
      expect(clearSessionMock).toHaveBeenCalledWith('abc123');
    });
  });

  it('clear_session_memory ignores wrong instance_id', async () => {
    const { _processControlMessage } = await import('./kill-switch-listener.js');
    _processControlMessage(
      JSON.stringify({
        action: 'clear_session_memory',
        session_id: 'abc123',
        instance_id: 'other-instance',
        reason: 'test',
      }),
    );
    await new Promise((r) => setTimeout(r, 10));
    expect(clearSessionMock).not.toHaveBeenCalled();
  });

  it('suspend_session immediately suspends session', async () => {
    const { isSessionSuspended, _processControlMessage } = await import('./kill-switch-listener.js');
    _processControlMessage(
      JSON.stringify({
        action: 'suspend_session',
        session_id: 'sess-1',
        instance_id: 'test-001',
        reason: 'test',
      }),
    );
    expect(isSessionSuspended('sess-1')).toBe(true);
  });

  it('resume_session clears suspended session', async () => {
    const { isSessionSuspended, _processControlMessage } = await import('./kill-switch-listener.js');
    _processControlMessage(
      JSON.stringify({
        action: 'suspend_session',
        session_id: 'sess-1',
        instance_id: 'test-001',
        reason: 'test',
      }),
    );
    _processControlMessage(
      JSON.stringify({
        action: 'resume_session',
        session_id: 'sess-1',
        instance_id: 'test-001',
      }),
    );
    expect(isSessionSuspended('sess-1')).toBe(false);
  });
});
