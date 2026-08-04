import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { complianceRouter } from '../compliance.js';

const loadMock = vi.fn();

vi.mock('../../governance/load-regulatory-classification.js', () => ({
  loadRegulatoryClassification: (...args: unknown[]) => loadMock(...args),
}));

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.scoutAuth = { kind: 'operator' };
    next();
  });
  app.use('/api/compliance', complianceRouter);
  return app;
}

describe('GET /api/compliance/regulatory-classification', () => {
  beforeEach(() => {
    loadMock.mockReset();
  });

  it('returns regulatory classification JSON', async () => {
    loadMock.mockResolvedValue({
      eu_ai_act: {
        tier: 'limited_risk',
        tier_label: 'Limited Risk',
        reasoning: ['Risk score is 18'],
        article_refs: ['Article 52 - transparency obligations'],
        gaps: ['Configure alert channels'],
      },
      uk_dsit: {
        alignment: 'partial',
        alignment_label: 'Partial alignment with DSIT principles',
        principles_met: ['Safety'],
        principles_partial: ['Fairness', 'Explainability', 'Contestability'],
      },
      assessed_at: '2026-06-13T16:00:00.000Z',
      data_sufficient: true,
    });

    const res = await request(buildApp())
      .get('/api/compliance/regulatory-classification')
      .expect(200);

    expect(res.body.eu_ai_act.tier).toBe('limited_risk');
    expect(res.body.data_sufficient).toBe(true);
    expect(loadMock).toHaveBeenCalledOnce();
  });

  it('returns 500 when classification load fails', async () => {
    loadMock.mockRejectedValue(new Error('db down'));

    const res = await request(buildApp())
      .get('/api/compliance/regulatory-classification')
      .expect(500);

    expect(res.body.error).toBe('Internal server error');
  });
});
