import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const queryMock = vi.fn();
const deployApiKeyMock = vi.fn();
const deployFileMock = vi.fn();

vi.mock('../../db.js', () => ({
  pool: { query: (...args: unknown[]) => queryMock(...args) },
}));

vi.mock('../../security/honeypot-manager.js', () => ({
  honeypotManager: {
    deployApiKeyHoneypot: (...args: unknown[]) => deployApiKeyMock(...args),
    deployFileHoneypots: (...args: unknown[]) => deployFileMock(...args),
    listHoneypots: vi.fn(),
    checkApiKey: vi.fn(),
    checkFilePath: vi.fn(),
    getHoneypot: vi.fn(),
  },
  serializeHoneypot: (h: Record<string, unknown>) => h,
}));

import { honeypotsRouter } from '../honeypots.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/honeypots', honeypotsRouter);
  return app;
}

function honeypotRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'hp-1',
    type: 'api_key',
    name: 'honeypot-openai-test',
    value: 'sk-lab-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    description: 'Fake openai API key',
    instanceId: 'carina-local',
    triggered: false,
    triggeredAt: null,
    triggerIp: null,
    triggerMetadata: {},
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('POST /api/honeypots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMock.mockReset();
    deployApiKeyMock.mockReset();
    deployFileMock.mockReset();
    queryMock.mockResolvedValue({ rows: [] });
  });

  it('deploys api_key honeypot with snake_case fields', async () => {
    deployApiKeyMock.mockResolvedValueOnce(honeypotRecord());

    const res = await request(makeApp())
      .post('/api/honeypots')
      .send({ type: 'api_key', instance_id: 'carina-local', key_type: 'openai' });

    expect(res.status).toBe(201);
    expect(res.body.honeypot.value).toMatch(/^sk-lab-/);
    expect(deployApiKeyMock).toHaveBeenCalledWith('carina-local', 'openai');
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('honeypot_deployed'),
      expect.arrayContaining(['carina-local']),
    );
  });

  it('deploys file honeypots and logs security event', async () => {
    deployFileMock.mockResolvedValueOnce([
      honeypotRecord({ type: 'file', value: '/tmp/.carina-backup.key' }),
    ]);

    const res = await request(makeApp())
      .post('/api/honeypots')
      .send({ type: 'file', instance_id: 'carina-local' });

    expect(res.status).toBe(201);
    expect(res.body.honeypots).toHaveLength(1);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('honeypot_deployed'),
      expect.arrayContaining(['carina-local']),
    );
  });
});

describe('GET /api/honeypots/summary', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('returns aggregated counts', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        { total: '2', triggered: '1', untriggered: '1', type: 'api_key', type_count: '1' },
        { total: '2', triggered: '1', untriggered: '1', type: 'file', type_count: '1' },
        { total: '2', triggered: '1', untriggered: '1', type: null, type_count: '2' },
      ],
    });

    const res = await request(makeApp())
      .get('/api/honeypots/summary?instance_id=carina-local');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      total: 2,
      triggered: 1,
      untriggered: 1,
      by_type: { api_key: 1, file: 1 },
    });
  });

  it('requires instance_id', async () => {
    const res = await request(makeApp()).get('/api/honeypots/summary');
    expect(res.status).toBe(400);
  });
});
