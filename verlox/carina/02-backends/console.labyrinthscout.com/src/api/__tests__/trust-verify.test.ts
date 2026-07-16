import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { publicTrustRouter } from '../public-trust.js';

vi.mock('../../trust/load-trust-identity.js', () => ({
  loadReferenceTrustIdentity: vi.fn(),
}));
vi.mock('../../trust/erc8126/load-verifications.js', () => ({
  loadLatestTrustVerification: vi.fn(),
}));
vi.mock('../../trust/load-trust-attestations.js', () => ({
  loadRecentTrustAttestations: vi.fn(),
}));

import { loadReferenceTrustIdentity } from '../../trust/load-trust-identity.js';
import { loadLatestTrustVerification } from '../../trust/erc8126/load-verifications.js';
import { loadRecentTrustAttestations } from '../../trust/load-trust-attestations.js';

function makeApp() {
  const app = express();
  app.use('/api/public/trust', publicTrustRouter);
  return app;
}

describe('GET /api/public/trust/verify/:agentId', () => {
  beforeEach(() => {
    vi.mocked(loadReferenceTrustIdentity).mockReset();
    vi.mocked(loadLatestTrustVerification).mockReset();
    vi.mocked(loadRecentTrustAttestations).mockReset();
  });

  it('returns gate_passed when risk is within threshold', async () => {
    vi.mocked(loadReferenceTrustIdentity).mockResolvedValue({
      registered: true,
      slug: 'carina-reference',
      name: 'Carina',
      agent_id: '7',
      agent_registry: null,
      wallet_address: '0x1111111111111111111111111111111111111111',
      registry_explorer_url: null,
      register_tx_url: null,
      status: 'live',
    });
    vi.mocked(loadLatestTrustVerification).mockResolvedValue({
      id: 'v1',
      identity_slug: 'carina-reference',
      agent_id: '7',
      chain_id: 84532,
      wav_risk_score: 10,
      wv_risk_score: 12,
      unified_risk_score: 11,
      trust_response_score: 89,
      request_hash: '0xabc',
      request_tx_hash: '0xreq',
      response_tx_hash: '0xres',
      response_uri: null,
      status: 'submitted',
      details: {},
      submitted_at: new Date('2026-06-10T12:00:00.000Z'),
    });
    vi.mocked(loadRecentTrustAttestations).mockResolvedValue([]);

    const res = await request(makeApp()).get('/api/public/trust/verify/7?max_risk=40');
    expect(res.status).toBe(200);
    expect(res.body.gate_passed).toBe(true);
    expect(res.body.risk_score).toBe(11);
  });

  it('returns 404 for unknown agent id', async () => {
    vi.mocked(loadReferenceTrustIdentity).mockResolvedValue({
      registered: true,
      slug: 'carina-reference',
      name: 'Carina',
      agent_id: '7',
      agent_registry: null,
      wallet_address: null,
      registry_explorer_url: null,
      register_tx_url: null,
      status: 'live',
    });

    const res = await request(makeApp()).get('/api/public/trust/verify/99');
    expect(res.status).toBe(404);
    expect(res.body.gate_passed).toBe(false);
  });
});
