import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LabyrinthScoutAttestationAdapter } from '../attestation-adapter.js';

vi.mock('../load-trust-identity.js', () => ({
  loadReferenceTrustIdentity: vi.fn(),
}));

vi.mock('../attestation-metrics.js', () => ({
  fetchAttestationMetricsFromDb: vi.fn(),
}));

vi.mock('../load-trust-attestations.js', () => ({
  getLastAttestationAt: vi.fn(),
  storeTrustAttestation: vi.fn(),
}));

vi.mock('../create-trust-sdk.js', () => ({
  createTrustSdk: vi.fn(),
}));

vi.mock('../../lib/trust-settings.js', () => ({
  resolveEnterpriseIntervals: vi.fn().mockResolvedValue({
    attestationDays: 7,
    verificationDays: 7,
  }),
}));

import { runWeeklyAttestation } from '../run-weekly-attestation.js';
import { loadReferenceTrustIdentity } from '../load-trust-identity.js';
import { fetchAttestationMetricsFromDb } from '../attestation-metrics.js';
import { getLastAttestationAt, storeTrustAttestation } from '../load-trust-attestations.js';

describe('runWeeklyAttestation', () => {
  beforeEach(() => {
    vi.mocked(loadReferenceTrustIdentity).mockReset();
    vi.mocked(fetchAttestationMetricsFromDb).mockReset();
    vi.mocked(getLastAttestationAt).mockReset();
    vi.mocked(storeTrustAttestation).mockReset();
  });

  it('submits and stores attestation when eligible', async () => {
    vi.mocked(loadReferenceTrustIdentity).mockResolvedValue({
      registered: true,
      slug: 'carina-reference',
      name: 'Carina',
      agent_id: '1',
      agent_registry: 'eip155:84532:0xabc',
      wallet_address: '0x2222222222222222222222222222222222222222',
      registry_explorer_url: null,
      register_tx_url: null,
      status: 'live',
    });
    vi.mocked(getLastAttestationAt).mockResolvedValue(null);
    vi.mocked(fetchAttestationMetricsFromDb).mockResolvedValue({
      metrics: {} as never,
      fields: {
        securityScore: 92,
        runtimeHours: 720,
        threatsDetected: 0,
        injectionBlocks: 0,
        sandboxViolations: 0,
      },
      eligibility: { eligible: true },
    });

    const adapter = {
      submitSecurityAttestation: vi.fn().mockResolvedValue({
        txHash: '0xdeadbeef',
        interactionId: '0xabc',
        namespace: 'labyrinth-scout.v1',
        tag: 'runtime.clean',
        score: 92,
        comment: '{}',
      }),
    } as unknown as LabyrinthScoutAttestationAdapter;

    const result = await runWeeklyAttestation({ adapter, now: new Date('2026-06-10T12:00:00.000Z') });

    expect(result.ok).toBe(true);
    expect(result.txHash).toBe('0xdeadbeef');
    expect(storeTrustAttestation).toHaveBeenCalledOnce();
  });

  it('skips when runtime incidents block eligibility', async () => {
    vi.mocked(loadReferenceTrustIdentity).mockResolvedValue({
      registered: true,
      slug: 'carina-reference',
      name: 'Carina',
      agent_id: '1',
      agent_registry: null,
      wallet_address: '0x2222222222222222222222222222222222222222',
      registry_explorer_url: null,
      register_tx_url: null,
      status: 'live',
    });
    vi.mocked(getLastAttestationAt).mockResolvedValue(null);
    vi.mocked(fetchAttestationMetricsFromDb).mockResolvedValue({
      metrics: {} as never,
      fields: {} as never,
      eligibility: { eligible: false, reason: 'incidents' },
    });

    const result = await runWeeklyAttestation({
      adapter: { submitSecurityAttestation: vi.fn() } as never,
    });

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('incidents');
  });
});
