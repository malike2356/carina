import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { complianceSocRouter, compliancePublicRouter } from '../../api/compliance-soc.js';

vi.mock('../../compliance/scoring.js', () => ({
  getComplianceScore: vi.fn(),
  calculateScoutScore: vi.fn(),
}));

vi.mock('../../compliance/security-score.js', () => ({
  getSecurityScore: vi.fn(),
}));

vi.mock('../../compliance/auditor-links.js', () => ({
  createAuditorLink: vi.fn(),
  listActiveAuditorLinks: vi.fn(),
  revokeAuditorLink: vi.fn(),
  validateAuditorToken: vi.fn(),
}));

vi.mock('../../compliance/trust-center.js', () => ({
  buildTrustCenterPayload: vi.fn(),
}));

vi.mock('../../compliance/export.js', () => ({
  streamComplianceExport: vi.fn(),
}));

import { getComplianceScore, calculateScoutScore } from '../../compliance/scoring.js';
import { getSecurityScore } from '../../compliance/security-score.js';
import { validateAuditorToken } from '../../compliance/auditor-links.js';
import { buildTrustCenterPayload } from '../../compliance/trust-center.js';

function authApp(router: express.Router, base: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.scoutAuth = { kind: 'operator' };
    next();
  });
  app.use(base, router);
  return app;
}

const configuredCompliance = {
  configured: true,
  totalControls: 31,
  coveredControls: 10,
  coveragePercent: 32,
  evidenceCount: 42,
  evidenceWindow: { start: '2025-06-19', end: '2026-06-19' },
  lastCollectionAt: '2026-06-18T00:00:00.000Z',
  controls: [],
  trendData: [],
};

describe('GET /api/compliance/score', () => {
  beforeEach(() => {
    vi.mocked(getComplianceScore).mockReset();
    vi.mocked(getSecurityScore).mockReset();
    vi.mocked(calculateScoutScore).mockReset();
  });

  it('returns combined scout score payload', async () => {
    vi.mocked(getComplianceScore).mockResolvedValue(configuredCompliance);
    vi.mocked(getSecurityScore).mockResolvedValue({ score: 85, riskScore: 15 });
    vi.mocked(calculateScoutScore).mockReturnValue({ total: 74, security: 85, compliance: 32 });

    const res = await request(authApp(complianceSocRouter, '/api/compliance'))
      .get('/api/compliance/score')
      .expect(200);

    expect(res.body.scoutScore).toBe(74);
    expect(res.body.compliance.configured).toBe(true);
  });
});

describe('GET /api/public/compliance/auditor/:token', () => {
  beforeEach(() => {
    vi.mocked(validateAuditorToken).mockReset();
    vi.mocked(getComplianceScore).mockReset();
  });

  it('returns 404 for invalid token', async () => {
    vi.mocked(validateAuditorToken).mockResolvedValue(false);
    const app = express();
    app.use('/api/public/compliance', compliancePublicRouter);

    const res = await request(app)
      .get('/api/public/compliance/auditor/bad-token')
      .expect(404);

    expect(res.body.error).toContain('Invalid or expired');
  });

  it('returns read-only compliance summary for valid token', async () => {
    vi.mocked(validateAuditorToken).mockResolvedValue(true);
    vi.mocked(getComplianceScore).mockResolvedValue(configuredCompliance);

    const app = express();
    app.use('/api/public/compliance', compliancePublicRouter);

    const res = await request(app)
      .get('/api/public/compliance/auditor/good-token')
      .expect(200);

    expect(res.body.coveragePercent).toBe(32);
    expect(res.body.organizationName).toBeTruthy();
  });
});

describe('GET /api/public/compliance/trust-center', () => {
  it('returns live trust center payload', async () => {
    vi.mocked(buildTrustCenterPayload).mockResolvedValue({
      monitoringSince: '2026-06-01',
      soc2ControlsCovered: 10,
      soc2ControlsTotal: 31,
      lastAuditorPackageAt: null,
      criticalFindings90Days: 0,
      cryptographicAnchors: 'Ethereum mainnet',
      anchoringFrequency: 'daily',
      soc2Badge: 'partial',
      iso27001Badge: 'aligned',
      gdprBadge: 'compliant',
      complianceTrend: [],
      controls: [],
    });

    const app = express();
    app.use('/api/public/compliance', compliancePublicRouter);

    const res = await request(app)
      .get('/api/public/compliance/trust-center')
      .expect(200);

    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.body.soc2Badge).toBe('partial');
  });
});
