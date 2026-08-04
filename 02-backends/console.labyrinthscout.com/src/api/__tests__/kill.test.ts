import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

vi.mock('../../security/forensic-snapshot.js', () => ({
  captureForensicSnapshot: vi.fn().mockResolvedValue({
    snapshotId: 'snap-1',
    instanceId: 'carina-local',
    reason: 'policy violation',
    artifacts: {},
  }),
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

describe('dashboard kill and resume routes via engine proxy', () => {
  beforeEach(() => {
    vi.resetModules();
    queryMock.mockReset();
    publishMock.mockReset();
    vi.stubEnv('SCOUT_ENGINE_URL', 'http://engine.test');
    vi.stubEnv('SCOUT_ENGINE_API_KEY', 'engine-key');
    vi.stubEnv('SCOUT_API_KEY', 'engine-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function buildApp() {
    return import('../kill.js').then(({ killRouter }) =>
      import('../resume.js').then(({ resumeRouter }) => {
        const app = express();
        app.use(express.json());
        app.use('/api/kill', killRouter);
        app.use('/api/resume', resumeRouter);
        return app;
      }),
    );
  }

  it('proxies kill to the engine internal control API', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ account_id: 'org-1' }] });
    const fetchMock = vi.fn(async () => ({
      status: 200,
      headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
      text: async () => JSON.stringify({ ok: true, audit_code: 'K-2026-07-28-001' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const app = await buildApp();
    const res = await request(app)
      .post('/api/kill/carina-local')
      .set('X-Scout-Key', 'engine-key')
      .send({ reason: 'policy violation' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.audit_code).toBe('K-2026-07-28-001');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string>; body: string }];
    expect(url).toBe('http://engine.test/api/internal/control/pause');
    expect(init.headers['X-Scout-Internal-Key']).toBe('engine-key');
    expect(JSON.parse(init.body)).toMatchObject({
      organization_id: 'org-1',
      agent_id: 'carina-local',
      command: 'kill',
    });
  });

  it('proxies resume to the engine internal control API', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ account_id: 'org-1' }] });
    const fetchMock = vi.fn(async () => ({
      status: 200,
      headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
      text: async () => JSON.stringify({ ok: true, audit_code: 'K-2026-07-28-002' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const app = await buildApp();
    const res = await request(app)
      .post('/api/resume/carina-local')
      .set('X-Scout-Key', 'engine-key')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.audit_code).toBe('K-2026-07-28-002');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string>; body: string }];
    expect(url).toBe('http://engine.test/api/internal/control/resume');
    expect(init.headers['X-Scout-Internal-Key']).toBe('engine-key');
    expect(JSON.parse(init.body)).toMatchObject({
      organization_id: 'org-1',
      agent_id: 'carina-local',
      command: 'resume',
    });
  });
});
