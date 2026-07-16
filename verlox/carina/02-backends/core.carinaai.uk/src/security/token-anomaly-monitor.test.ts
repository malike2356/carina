import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();
const appendSecurityAudit = vi.fn();

vi.mock('../memory/db.js', () => ({ pool: { query } }));
vi.mock('./security-audit.js', () => ({
  appendSecurityAudit: (...args: unknown[]) => appendSecurityAudit(...args),
}));

describe('token-anomaly-monitor and security-alerting', () => {
  beforeEach(() => {
    query.mockReset();
    appendSecurityAudit.mockReset();
    vi.resetModules();
  });

  it('creates velocity alert and suspends when configured', async () => {
    // schema + baseline empty + suspend insert
    query.mockResolvedValue({ rows: [], rowCount: 0 });

    const { monitorTokenRequest, _resetTokenVelocityForTests } = await import('./token-anomaly-monitor.js');
    const { _resetSecurityAlertingForTests } = await import('./security-alerting.js');
    _resetTokenVelocityForTests();
    _resetSecurityAlertingForTests();

    const fingerprint = {
      fingerprint: 'fp',
      ipHash: 'ip',
      uaHash: 'ua',
      uaSummary: 'curl',
      clientHint: null,
    };

    let last = await monitorTokenRequest({
      tokenId: 'tok-vel',
      tenantId: 'p1',
      fingerprint,
      rateLimitRpm: 3,
      autoSuspend: true,
    });
    expect(last.blocked).toBe(false);

    await monitorTokenRequest({
      tokenId: 'tok-vel',
      tenantId: 'p1',
      fingerprint,
      rateLimitRpm: 3,
      autoSuspend: true,
    });
    await monitorTokenRequest({
      tokenId: 'tok-vel',
      tenantId: 'p1',
      fingerprint,
      rateLimitRpm: 3,
      autoSuspend: true,
    });
    last = await monitorTokenRequest({
      tokenId: 'tok-vel',
      tenantId: 'p1',
      fingerprint,
      rateLimitRpm: 3,
      autoSuspend: true,
    });
    expect(last.blocked).toBe(true);
    expect(last.suspended).toBe(true);
    expect(last.code).toBe('TOKEN_SUSPENDED');
    expect(appendSecurityAudit).toHaveBeenCalled();
  });

  it('records scope violations in audit', async () => {
    const { recordScopeViolation } = await import('./token-anomaly-monitor.js');
    const { _resetSecurityAlertingForTests } = await import('./security-alerting.js');
    _resetSecurityAlertingForTests();
    recordScopeViolation('tok-1', 'memory');
    expect(appendSecurityAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'token_anomaly',
        action: 'scope_violation',
      }),
    );
  });

  it('suppresses duplicate alerts within the window', async () => {
    const { recordSecuritySignal, _resetSecurityAlertingForTests } = await import('./security-alerting.js');
    _resetSecurityAlertingForTests();

    const first = recordSecuritySignal('failed_auth', 'ip-1');
    // need 5 in window
    recordSecuritySignal('failed_auth', 'ip-1');
    recordSecuritySignal('failed_auth', 'ip-1');
    recordSecuritySignal('failed_auth', 'ip-1');
    const fired = recordSecuritySignal('failed_auth', 'ip-1');
    expect(fired.fired || first.fired).toBe(true);

    const suppressed = recordSecuritySignal('failed_auth', 'ip-1');
    // After threshold, further signals in suppression window should not fire again
    // (count still increments but alert is suppressed)
    expect(suppressed.suppressed || !suppressed.fired).toBe(true);
  });
});
