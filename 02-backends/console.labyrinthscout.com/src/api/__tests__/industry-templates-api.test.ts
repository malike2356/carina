import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../../db.js', () => ({
  pool: { query: vi.fn().mockResolvedValue({ rows: [] }) },
}));

vi.mock('../../security/policy-packs.js', () => ({
  applyPolicyPack: vi.fn().mockResolvedValue({
    packId: 'regulated',
    appliedAt: new Date().toISOString(),
    appliedBy: 'operator',
  }),
}));

vi.mock('../../redis.js', () => ({
  getRedis: () => null,
}));

vi.mock('../../config/index.js', () => ({
  config: { auth: { apiKey: 'test-scout-key' } },
}));

const VALID_KEY = 'test-scout-key';

async function makeApp() {
  const { requireApiKey } = await import('../../middleware/auth.js');
  const { industryTemplatesRouter } = await import('../industry-templates.js');
  const { resetIndustryTemplateStoreForTests } = await import('../../lib/industry-template-store.js');
  resetIndustryTemplateStoreForTests();
  const app = express();
  app.use(express.json());
  app.use('/api/governance/templates', requireApiKey, industryTemplatesRouter);
  return app;
}

describe('industryTemplatesRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/governance/templates returns 200 with array of 4', async () => {
    const app = await makeApp();
    const res = await request(app)
      .get('/api/governance/templates')
      .set('X-Scout-Key', VALID_KEY);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(4);
    expect(res.body[0]).toHaveProperty('regulations');
    expect(res.body[0]).toHaveProperty('event_mappings');
  });

  it('GET /api/governance/templates/uk-property returns correct template', async () => {
    const app = await makeApp();
    const res = await request(app)
      .get('/api/governance/templates/uk-property')
      .set('X-Scout-Key', VALID_KEY);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('uk-property');
    expect(res.body.label).toContain('Property');
  });

  it('GET /api/governance/templates/invalid returns 404', async () => {
    const app = await makeApp();
    const res = await request(app)
      .get('/api/governance/templates/not-a-real-template')
      .set('X-Scout-Key', VALID_KEY);
    expect(res.status).toBe(404);
  });

  it('POST /api/governance/templates/uk-property/apply returns applied:true', async () => {
    const app = await makeApp();
    const res = await request(app)
      .post('/api/governance/templates/uk-property/apply')
      .set('X-Scout-Key', VALID_KEY)
      .send({ instance_id: 'carina-local', applied_by: 'operator' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      applied: true,
      template_id: 'uk-property',
      base_pack_applied: 'regulated',
    });
    expect(res.body.human_review_tools).toContain('email-send');
  });

  it('GET /api/governance/templates/active returns null before any template applied', async () => {
    const app = await makeApp();
    const res = await request(app)
      .get('/api/governance/templates/active')
      .set('X-Scout-Key', VALID_KEY);
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});
