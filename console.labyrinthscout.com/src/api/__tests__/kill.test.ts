import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CONTROL_CHANNEL, STATUS_SUSPENDED } from '../../lib/constants.js';

const queryMock = vi.fn();
const publishMock = vi.fn();

vi.mock('../../db.js', () => ({
  pool: { query: (...args: unknown[]) => queryMock(...args) },
}));

vi.mock('../../redis.js', () => ({
  getRedis: () => ({ publish: publishMock }),
}));

vi.mock('../../api/sse.js', () => ({
  broadcastEvent: vi.fn(),
  refreshAndBroadcastStats: vi.fn(),
}));

describe('validateKillReason', () => {
  it('accepts a valid reason', async () => {
    const { validateKillReason } = await import('../../lib/instance-control.js');
    const result = validateKillReason({ reason: 'policy violation' });
    expect(result).toEqual({ ok: true, reason: 'policy violation' });
  });

  it('rejects empty reason', async () => {
    const { validateKillReason } = await import('../../lib/instance-control.js');
    const result = validateKillReason({ reason: '   ' });
    expect(result.ok).toBe(false);
  });
});

describe('suspendInstance', () => {
  beforeEach(() => {
    vi.resetModules();
    queryMock.mockReset();
    publishMock.mockReset();
  });

  it('suspends instance and publishes Redis control message', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: 'carina-local', status: 'active' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: 'evt-1',
          severity: 'critical',
          source: 'scout-api',
          event_type: 'kill_switch_activated',
          description: 'x',
          metadata: {},
          created_at: new Date(),
        }],
      });

    const { suspendInstance } = await import('../../lib/instance-control.js');
    const result = await suspendInstance('carina-local', 'policy violation');

    expect(result).toEqual({
      ok: true,
      instance_id: 'carina-local',
      status: STATUS_SUSPENDED,
    });
    expect(publishMock).toHaveBeenCalledOnce();
    const [channel, payload] = publishMock.mock.calls[0] as [string, string];
    expect(channel).toBe(CONTROL_CHANNEL);
    expect(JSON.parse(payload)).toMatchObject({
      action: 'suspend',
      instance_id: 'carina-local',
      reason: 'policy violation',
    });
  });

  it('returns 404 when instance missing', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const { suspendInstance } = await import('../../lib/instance-control.js');
    const result = await suspendInstance('missing', 'reason');
    expect(result).toEqual({ ok: false, status: 404, error: 'Instance not found' });
    expect(publishMock).not.toHaveBeenCalled();
  });
});

describe('resumeInstance', () => {
  beforeEach(() => {
    vi.resetModules();
    queryMock.mockReset();
    publishMock.mockReset();
  });

  it('resumes suspended instance and publishes resume message', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: 'carina-local' }] })
      .mockResolvedValueOnce({
        rows: [{
          id: 'evt-2',
          severity: 'info',
          source: 'scout-api',
          event_type: 'kill_switch_resumed',
          description: 'x',
          metadata: {},
          created_at: new Date(),
        }],
      });

    const { resumeInstance } = await import('../../lib/instance-control.js');
    const result = await resumeInstance('carina-local');

    expect(result).toEqual({ ok: true, instance_id: 'carina-local', status: 'active' });
    expect(publishMock).toHaveBeenCalledOnce();
    expect(JSON.parse(publishMock.mock.calls[0]![1] as string)).toMatchObject({
      action: 'resume',
      instance_id: 'carina-local',
    });
  });
});
