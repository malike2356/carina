import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { freeScanRouter } from '../free-scan.js';

vi.mock('../../engines/domain.js', () => ({
  normalizeDomain: vi.fn((d: string) => (d === 'example.com' ? 'example.com' : null)),
  clientIp: vi.fn(() => '203.0.113.10'),
}));

vi.mock('../../findings/free-scan.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../findings/free-scan.js')>();
  return {
    ...actual,
    createFreeScan: vi.fn(),
    getRecentFreeScanForDomain: vi.fn(),
    loadFreeScanResult: vi.fn(),
  };
});

vi.mock('../../findings/free-scan-rate-limit.js', () => ({
  checkFreeScanRateLimit: vi.fn(),
  recordFreeScanRateLimit: vi.fn(),
}));

import {
  createFreeScan,
  getRecentFreeScanForDomain,
  loadFreeScanResult,
} from '../../findings/free-scan.js';
import {
  checkFreeScanRateLimit,
  recordFreeScanRateLimit,
} from '../../findings/free-scan-rate-limit.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/free-scan', freeScanRouter);
  return app;
}

describe('free-scan API', () => {
  beforeEach(() => {
    vi.mocked(createFreeScan).mockReset();
    vi.mocked(getRecentFreeScanForDomain).mockReset();
    vi.mocked(loadFreeScanResult).mockReset();
    vi.mocked(checkFreeScanRateLimit).mockReset();
    vi.mocked(recordFreeScanRateLimit).mockReset();
    vi.mocked(getRecentFreeScanForDomain).mockResolvedValue(null);
    vi.mocked(checkFreeScanRateLimit).mockResolvedValue({ allowed: true });
  });

  it('rejects invalid domains', async () => {
    const res = await request(makeApp())
      .post('/api/v1/free-scan')
      .send({ domain: 'bad domain' });
    expect(res.status).toBe(400);
  });

  it('queues a scan for valid domains', async () => {
    vi.mocked(createFreeScan).mockResolvedValue({
      scan: {
        id: 'scan-1',
        targetId: 't1',
        accountId: 'a1',
        tool: 'quick-scan',
        status: 'queued',
        startedAt: null,
        completedAt: null,
        findingsCount: 0,
        errorMessage: null,
        rawOutputPath: null,
        createdAt: '2026-06-19T10:00:00.000Z',
      },
      freeScanId: 'fs-1',
    });

    const res = await request(makeApp())
      .post('/api/v1/free-scan')
      .send({ domain: 'example.com' });

    expect(res.status).toBe(202);
    expect(res.body.scan_id).toBe('scan-1');
    expect(recordFreeScanRateLimit).toHaveBeenCalledWith('203.0.113.10', 'example.com');
  });

  it('returns completed scan payload', async () => {
    vi.mocked(loadFreeScanResult).mockResolvedValue({
      domain: 'example.com',
      scan: {
        id: 'scan-1',
        targetId: 't1',
        accountId: 'a1',
        tool: 'quick-scan',
        status: 'completed',
        startedAt: '2026-06-19T10:00:00.000Z',
        completedAt: '2026-06-19T10:01:30.000Z',
        findingsCount: 2,
        errorMessage: null,
        rawOutputPath: null,
        createdAt: '2026-06-19T10:00:00.000Z',
      },
      findings: [
        {
          id: 'f1',
          scanRunId: 'scan-1',
          targetId: 't1',
          accountId: 'a1',
          tool: 'nuclei',
          findingType: 'cve',
          severity: 'critical',
          cvssScore: 9.8,
          title: 'CVE-2024-1234',
          description: 'Test',
          remediation: null,
          rawData: {},
          status: 'open',
          isNew: true,
          firstSeen: '2026-06-19T10:01:00.000Z',
          lastSeen: '2026-06-19T10:01:00.000Z',
          createdAt: '2026-06-19T10:01:00.000Z',
        },
      ],
    });

    const res = await request(makeApp()).get('/api/v1/free-scan/scan-1');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(res.body.findings.critical).toBe(1);
    expect(res.body.cta.import_command).toContain('carina migrate');
  });
});
