import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Redis } from 'ioredis';
import {
  ToolPolicyEnforcer,
  RateLimitError,
  DEFAULT_POLICY,
} from './tool-policy.js';

function createMockRedis(minuteCount: number, hourCount: number): Redis {
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
  } as unknown as Redis;
}

vi.mock('../config/index.js', () => ({
  config: {
    labyrinth: {
      enabled: true,
      instanceId: 'test-001',
      instanceName: 'Test',
    },
    redis: { url: 'redis://localhost:6379' },
    database: { url: 'postgresql://localhost:5432/carina_test' },
  },
}));

describe('ToolPolicyEnforcer session rate override', () => {
  let reportFn: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    reportFn = vi.fn().mockResolvedValue(undefined);
    const mod = await import('./kill-switch-listener.js');
    mod._resetRateLimits();
  });

  it('uses operator override limit for throttled session', async () => {
    const { _processControlMessage } = await import('./kill-switch-listener.js');
    _processControlMessage(
      JSON.stringify({
        action: 'set_rate_limit',
        session_id: 'abc123',
        instance_id: 'test-001',
        calls_per_minute: 3,
        reason: 'test',
      }),
    );

    const enforcer = new ToolPolicyEnforcer(createMockRedis(4, 1), reportFn, undefined, 'test-001');

    await expect(enforcer.enforce('web-search', {}, 'abc123')).rejects.toBeInstanceOf(RateLimitError);
    expect(reportFn).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'rate_limit_exceeded',
        metadata: expect.objectContaining({
          limit: 3,
          source: 'operator_override',
        }),
      }),
    );
  });

  it('uses default limit when session has no override', async () => {
    const enforcer = new ToolPolicyEnforcer(createMockRedis(16, 1), reportFn, undefined, 'test-001');

    await expect(enforcer.enforce('web-search', {}, 'other-session')).rejects.toBeInstanceOf(
      RateLimitError,
    );
    expect(reportFn).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          limit: DEFAULT_POLICY.rateLimit.callsPerMinute,
          source: 'default',
        }),
      }),
    );
  });

  it('reverts to default after clear_rate_limit control message', async () => {
    const { _processControlMessage } = await import('./kill-switch-listener.js');
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

    const enforcer = new ToolPolicyEnforcer(createMockRedis(4, 1), reportFn, undefined, 'test-001');

    await expect(enforcer.enforce('web-search', {}, 'abc123')).resolves.toBe(true);
    expect(reportFn).not.toHaveBeenCalled();
  });
});
