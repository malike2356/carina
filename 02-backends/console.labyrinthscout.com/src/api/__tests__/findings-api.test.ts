import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { findingsRouter } from '../findings.js';
import { targetsRouter } from '../targets.js';
import { scoutScoreRouter } from '../scout-score.js';

vi.mock('../../findings/store.js', () => ({
  listFindings: vi.fn(),
  getFindingById: vi.fn(),
  createFinding: vi.fn(),
  updateFinding: vi.fn(),
  createTarget: vi.fn(),
  listTargets: vi.fn(),
  getTargetById: vi.fn(),
  deactivateTarget: vi.fn(),
  queueScanRun: vi.fn(),
  listScoreHistory: vi.fn(),
}));

vi.mock('../../findings/score.js', () => ({
  getCurrentScoutScore: vi.fn(),
}));

import {
  listFindings,
  createFinding,
  createTarget,
  listTargets,
  getTargetById,
  queueScanRun,
  updateFinding,
} from '../../findings/store.js';
import { getCurrentScoutScore } from '../../findings/score.js';

const ACCOUNT_ID = '550e8400-e29b-41d4-a716-446655440001';

function makeApp(router: express.Router, basePath: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.scoutAuth = { kind: 'account', accountId: ACCOUNT_ID };
    next();
  });
  app.use(basePath, router);
  return app;
}

describe('findings API', () => {
  beforeEach(() => {
    vi.mocked(listFindings).mockReset();
    vi.mocked(createFinding).mockReset();
    vi.mocked(updateFinding).mockReset();
    vi.mocked(getCurrentScoutScore).mockReset();
  });

  it('lists findings for the authenticated account', async () => {
    vi.mocked(listFindings).mockResolvedValue([
      {
        id: 'f1',
        scanRunId: null,
        targetId: 't1',
        accountId: ACCOUNT_ID,
        tool: 'nuclei',
        findingType: 'cve',
        severity: 'high',
        cvssScore: 7.5,
        title: 'CVE-2024-1234',
        description: null,
        remediation: null,
        rawData: {},
        status: 'open',
        isNew: true,
        firstSeen: '2026-06-19T10:00:00.000Z',
        lastSeen: '2026-06-19T10:00:00.000Z',
        createdAt: '2026-06-19T10:00:00.000Z',
      },
    ]);

    const res = await request(makeApp(findingsRouter, '/api/findings'))
      .get('/api/findings')
      .expect(200);

    expect(res.body.findings).toHaveLength(1);
    expect(listFindings).toHaveBeenCalledWith(ACCOUNT_ID, expect.objectContaining({}));
  });

  it('creates a finding and refreshes score', async () => {
    vi.mocked(createFinding).mockResolvedValue({
      id: 'f2',
      scanRunId: null,
      targetId: 't1',
      accountId: ACCOUNT_ID,
      tool: 'nmap',
      findingType: 'open_port',
      severity: 'info',
      cvssScore: null,
      title: 'Port 443 open',
      description: null,
      remediation: null,
      rawData: { port: 443 },
      status: 'open',
      isNew: true,
      firstSeen: '2026-06-19T10:00:00.000Z',
      lastSeen: '2026-06-19T10:00:00.000Z',
      createdAt: '2026-06-19T10:00:00.000Z',
    });
    vi.mocked(getCurrentScoutScore).mockResolvedValue({
      score: 99,
      openCritical: 0,
      openHigh: 0,
      openMedium: 0,
      openLow: 0,
      calculatedAt: '2026-06-19T10:00:00.000Z',
    });

    const res = await request(makeApp(findingsRouter, '/api/findings'))
      .post('/api/findings')
      .send({
        target_id: 't1',
        tool: 'nmap',
        finding_type: 'open_port',
        severity: 'info',
        title: 'Port 443 open',
      })
      .expect(201);

    expect(res.body.title).toBe('Port 443 open');
    expect(createFinding).toHaveBeenCalledOnce();
  });

  it('rejects finding create without required fields', async () => {
    const res = await request(makeApp(findingsRouter, '/api/findings'))
      .post('/api/findings')
      .send({ tool: 'nmap' })
      .expect(400);

    expect(res.body.error).toContain('required');
  });

  it('updates finding status', async () => {
    vi.mocked(getCurrentScoutScore).mockResolvedValue({
      score: 90,
      openCritical: 0,
      openHigh: 0,
      openMedium: 0,
      openLow: 0,
      calculatedAt: '2026-06-19T11:00:00.000Z',
    });
    vi.mocked(updateFinding).mockResolvedValue({
      id: 'f1',
      scanRunId: null,
      targetId: 't1',
      accountId: ACCOUNT_ID,
      tool: 'nuclei',
      findingType: 'cve',
      severity: 'high',
      cvssScore: 7.5,
      title: 'CVE-2024-1234',
      description: null,
      remediation: null,
      rawData: {},
      status: 'resolved',
      isNew: false,
      firstSeen: '2026-06-19T10:00:00.000Z',
      lastSeen: '2026-06-19T11:00:00.000Z',
      createdAt: '2026-06-19T10:00:00.000Z',
    });

    const res = await request(makeApp(findingsRouter, '/api/findings'))
      .patch('/api/findings/f1')
      .send({ status: 'resolved' })
      .expect(200);

    expect(res.body.status).toBe('resolved');
  });
});

describe('targets API', () => {
  beforeEach(() => {
    vi.mocked(createTarget).mockReset();
    vi.mocked(listTargets).mockReset();
    vi.mocked(getTargetById).mockReset();
    vi.mocked(queueScanRun).mockReset();
  });

  it('creates a target', async () => {
    vi.mocked(createTarget).mockResolvedValue({
      id: 't1',
      accountId: ACCOUNT_ID,
      target: 'example.com',
      targetType: 'domain',
      label: 'Production',
      isActive: true,
      createdAt: '2026-06-19T10:00:00.000Z',
    });

    const res = await request(makeApp(targetsRouter, '/api/targets'))
      .post('/api/targets')
      .send({
        target: 'example.com',
        target_type: 'domain',
        label: 'Production',
      })
      .expect(201);

    expect(res.body.target).toBe('example.com');
  });

  it('lists active targets', async () => {
    vi.mocked(listTargets).mockResolvedValue([]);

    await request(makeApp(targetsRouter, '/api/targets'))
      .get('/api/targets')
      .expect(200);

    expect(listTargets).toHaveBeenCalledWith(ACCOUNT_ID, true);
  });

  it('queues a manual scan', async () => {
    vi.mocked(getTargetById).mockResolvedValue({
      id: 't1',
      accountId: ACCOUNT_ID,
      target: 'example.com',
      targetType: 'domain',
      label: null,
      isActive: true,
      createdAt: '2026-06-19T10:00:00.000Z',
    });
    vi.mocked(queueScanRun).mockResolvedValue({
      id: 's1',
      targetId: 't1',
      accountId: ACCOUNT_ID,
      tool: 'nmap',
      status: 'queued',
      startedAt: null,
      completedAt: null,
      findingsCount: 0,
      errorMessage: null,
      rawOutputPath: null,
      createdAt: '2026-06-19T10:00:00.000Z',
    });

    const res = await request(makeApp(targetsRouter, '/api/targets'))
      .post('/api/targets/t1/scan')
      .send({ tool: 'nmap' })
      .expect(202);

    expect(res.body.status).toBe('queued');
  });
});

describe('score API', () => {
  beforeEach(() => {
    vi.mocked(getCurrentScoutScore).mockReset();
  });

  it('returns current scout score', async () => {
    vi.mocked(getCurrentScoutScore).mockResolvedValue({
      score: 85,
      openCritical: 0,
      openHigh: 2,
      openMedium: 1,
      openLow: 0,
      calculatedAt: '2026-06-19T10:00:00.000Z',
    });

    const res = await request(makeApp(scoutScoreRouter, '/api/score'))
      .get('/api/score')
      .expect(200);

    expect(res.body.score).toBe(85);
    expect(getCurrentScoutScore).toHaveBeenCalledWith(ACCOUNT_ID, true);
  });
});

describe('operator account scoping', () => {
  it('requires account_id for operator auth when no default is configured', async () => {
    delete process.env.SCOUT_OPERATOR_ACCOUNT_ID;
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.scoutAuth = { kind: 'operator' };
      next();
    });
    app.use('/api/findings', findingsRouter);

    const res = await request(app).get('/api/findings').expect(400);
    expect(res.body.error).toContain('account_id');
  });

  it('uses SCOUT_OPERATOR_ACCOUNT_ID for operator auth when query is omitted', async () => {
    process.env.SCOUT_OPERATOR_ACCOUNT_ID = ACCOUNT_ID;
    vi.mocked(listFindings).mockResolvedValue([]);
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.scoutAuth = { kind: 'operator' };
      next();
    });
    app.use('/api/findings', findingsRouter);

    const res = await request(app).get('/api/findings').expect(200);
    expect(res.body.findings).toEqual([]);
    expect(listFindings).toHaveBeenCalledWith(ACCOUNT_ID, expect.any(Object));
    delete process.env.SCOUT_OPERATOR_ACCOUNT_ID;
  });
});
