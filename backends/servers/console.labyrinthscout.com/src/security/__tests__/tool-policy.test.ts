import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Redis } from 'ioredis';
import {
  ToolPolicyEnforcer,
  ToolBlockedError,
  DangerousCommandError,
  RateLimitError,
  ConfirmationRequiredError,
  DEFAULT_POLICY,
} from '../tool-policy.js';

function createMockRedis(minuteCount: number, hourCount: number): Redis {
  const store = new Map<string, string>();
  let violationCount = 0;
  const pipeline = {
    incr: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([
      [null, minuteCount],
      [null, 1],
      [null, hourCount],
      [null, 1],
    ]),
  };
  return {
    pipeline: vi.fn(() => pipeline),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    incr: vi.fn(async (key: string) => {
      if (key.includes('rate-violations')) {
        violationCount += 1;
        return violationCount;
      }
      const next = Number(store.get(key) ?? '0') + 1;
      store.set(key, String(next));
      return next;
    }),
    expire: vi.fn(async () => 1),
  } as unknown as Redis;
}

describe('ToolPolicyEnforcer', () => {
  let reportFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    reportFn = vi.fn().mockResolvedValue(undefined);
  });

  it('blocks tools on the blocklist', async () => {
    const policy = {
      ...DEFAULT_POLICY,
      allowlist: [...DEFAULT_POLICY.allowlist],
      requireConfirmList: [...DEFAULT_POLICY.requireConfirmList],
      blocklist: ['shell-exec'],
      dangerousCommands: [...DEFAULT_POLICY.dangerousCommands],
      rateLimit: { ...DEFAULT_POLICY.rateLimit },
    };
    const enforcer = new ToolPolicyEnforcer(createMockRedis(1, 1), reportFn, policy, 'test-instance');

    await expect(enforcer.enforce('shell-exec', {}, 'session-1')).rejects.toBeInstanceOf(ToolBlockedError);
    expect(reportFn).toHaveBeenCalledOnce();
    expect(reportFn.mock.calls[0]?.[0]).toMatchObject({
      event_type: 'tool_blocked',
      severity: 'critical',
    });
  });

  it('blocks dangerous rm -rf on system paths', async () => {
    const enforcer = new ToolPolicyEnforcer(createMockRedis(1, 1), reportFn, undefined, 'test-instance');

    await expect(
      enforcer.enforce('shell-exec', { command: 'rm -rf /var/log/carina' }, 'session-1'),
    ).rejects.toBeInstanceOf(DangerousCommandError);

    expect(reportFn).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'dangerous_command_blocked' }),
    );
  });

  it('blocks rm -rf on absolute paths under tmp', async () => {
    const enforcer = new ToolPolicyEnforcer(createMockRedis(1, 1), reportFn, undefined, 'test-instance');

    await expect(
      enforcer.enforce('shell-exec', { command: 'rm -rf /tmp/test-output' }, 'session-1'),
    ).rejects.toBeInstanceOf(DangerousCommandError);
  });

  it('allows safe shell commands', async () => {
    const enforcer = new ToolPolicyEnforcer(createMockRedis(1, 1), reportFn, undefined, 'test-instance');

    await expect(
      enforcer.enforce('shell-exec', { command: 'ls /tmp' }, 'session-1'),
    ).resolves.toBe(true);
    expect(reportFn).not.toHaveBeenCalled();
  });

  it('throws RateLimitError when minute limit exceeded', async () => {
    const redis = createMockRedis(1, 1);
    const enforcer = new ToolPolicyEnforcer(redis, reportFn, undefined, 'test-instance');

    for (let i = 0; i < DEFAULT_POLICY.rateLimit.callsPerMinute; i += 1) {
      await enforcer.enforce('web-search', {}, 'session-1');
    }

    await expect(enforcer.enforce('web-search', {}, 'session-1')).rejects.toBeInstanceOf(RateLimitError);
    expect(reportFn).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'rate_limit_exceeded',
        severity: 'warning',
      }),
    );
  });

  it('blocks FREE tier tenants from terminal tools with upgrade message', async () => {
    const policy = {
      ...DEFAULT_POLICY,
      tier: 'FREE' as const,
      allowlist: [],
      blocklist: [],
      requireConfirmList: [],
      dangerousCommands: [...DEFAULT_POLICY.dangerousCommands],
      rateLimit: { ...DEFAULT_POLICY.rateLimit },
    };
    const enforcer = new ToolPolicyEnforcer(createMockRedis(1, 1), reportFn, policy, 'test-instance');

    await expect(enforcer.enforce('shell-exec', {}, 'session-1')).rejects.toThrow(
      "Tool 'terminal' is not available on your plan. Upgrade to PRO.",
    );
  });

  it('requires confirmation for file-write without _confirmed', async () => {
    const enforcer = new ToolPolicyEnforcer(createMockRedis(1, 1), reportFn, undefined, 'test-instance');

    await expect(
      enforcer.enforce('file-write', { path: '/tmp/out.txt', content: 'hello' }, 'session-1'),
    ).rejects.toBeInstanceOf(ConfirmationRequiredError);
    expect(reportFn).not.toHaveBeenCalled();
  });

  it('allows file-write when _confirmed is true', async () => {
    const enforcer = new ToolPolicyEnforcer(createMockRedis(1, 1), reportFn, undefined, 'test-instance');

    await expect(
      enforcer.enforce(
        'file-write',
        { path: '/tmp/out.txt', content: 'hello', _confirmed: true },
        'session-1',
      ),
    ).resolves.toBe(true);
    expect(reportFn).not.toHaveBeenCalled();
  });
});

describe('loadPolicyFromEnv', () => {
  it('parses blocklist from SCOUT_BLOCKLIST', async () => {
    const prev = process.env.SCOUT_BLOCKLIST;
    process.env.SCOUT_BLOCKLIST = 'shell-exec,code-exec';
    vi.resetModules();
    const { loadPolicyFromEnv } = await import('../tool-policy.js');
    const policy = loadPolicyFromEnv();
    expect(policy.blocklist).toEqual(['shell-exec', 'code-exec']);
    process.env.SCOUT_BLOCKLIST = prev;
  });
});
