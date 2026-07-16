import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock redis
const redisMock = {
  incr: vi.fn(),
  expire: vi.fn(),
  get: vi.fn(),
};

vi.mock('../../redis.js', () => ({
  getRedis: () => redisMock,
}));

import { shouldSuppress, shouldEscalate } from '../throttle.js';

describe('Alert Throttle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('first alert passes through (not suppressed)', async () => {
    redisMock.incr.mockResolvedValue(1);
    const result = await shouldSuppress('tenant-1', 'critical', 'injection_blocked');
    expect(result.suppress).toBe(false);
  });

  it('second identical alert within 5 min is suppressed', async () => {
    redisMock.incr.mockResolvedValue(2);
    const result = await shouldSuppress('tenant-1', 'critical', 'injection_blocked');
    expect(result.suppress).toBe(true);
  });

  it('alerts with different event types are tracked separately', async () => {
    redisMock.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    const r1 = await shouldSuppress('t1', 'critical', 'injection_blocked');
    const r2 = await shouldSuppress('t1', 'critical', 'kill_switch_triggered');
    expect(r1.suppress).toBe(false);
    expect(r2.suppress).toBe(false);
  });

  it('shouldEscalate returns true when suppression count >= 10', async () => {
    redisMock.get.mockResolvedValue('11');
    const result = await shouldEscalate('tenant-1', 'critical');
    expect(result).toBe(true);
  });

  it('shouldEscalate returns false when suppression count < 10', async () => {
    redisMock.get.mockResolvedValue('5');
    const result = await shouldEscalate('tenant-1', 'warning');
    expect(result).toBe(false);
  });
});
