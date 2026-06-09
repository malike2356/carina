import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../load-trust-identity.js', () => ({
  loadReferenceTrustIdentity: vi.fn(),
}));

vi.mock('../load-verifications.js', () => ({
  getLastVerificationAt: vi.fn(),
  storeTrustVerification: vi.fn(),
}));

vi.mock('../validation-registry.js', () => ({
  createValidationRegistryClients: vi.fn(),
  submitValidationRequest: vi.fn(),
  submitValidationResponse: vi.fn(),
}));

vi.mock('../../../lib/trust-settings.js', () => ({
  resolveEnterpriseIntervals: vi.fn().mockResolvedValue({
    attestationDays: 7,
    verificationDays: 7,
  }),
}));

import { runWeeklyVerification } from '../run-weekly-verification.js';
import { loadReferenceTrustIdentity } from '../../load-trust-identity.js';
import { getLastVerificationAt, storeTrustVerification } from '../load-verifications.js';
import {
  createValidationRegistryClients,
  submitValidationRequest,
  submitValidationResponse,
} from '../validation-registry.js';

describe('runWeeklyVerification', () => {
  beforeEach(() => {
    vi.mocked(loadReferenceTrustIdentity).mockReset();
    vi.mocked(getLastVerificationAt).mockReset();
    vi.mocked(storeTrustVerification).mockReset();
    vi.mocked(createValidationRegistryClients).mockReset();
    vi.mocked(submitValidationRequest).mockReset();
    vi.mocked(submitValidationResponse).mockReset();
  });

  it('submits ERC-8126 verification when eligible', async () => {
    vi.mocked(loadReferenceTrustIdentity).mockResolvedValue({
      registered: true,
      slug: 'carina-reference',
      name: 'Carina',
      agent_id: '7',
      agent_registry: null,
      wallet_address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      registry_explorer_url: null,
      register_tx_url: null,
      status: 'live',
    });
    vi.mocked(getLastVerificationAt).mockResolvedValue(null);
    vi.mocked(createValidationRegistryClients).mockReturnValue({
      publicClient: {} as never,
      walletClient: {} as never,
      validatorAddress: '0x1111111111111111111111111111111111111111',
      registryAddress: '0x8004B663056A597Dffe9eCcC1965A193B7388713',
      chainId: 84532,
    });
    vi.mocked(submitValidationRequest).mockResolvedValue({
      requestHash: '0xabc',
      requestUri: 'data:application/json;base64,e30=',
      txHash: '0xrequest',
    });
    vi.mocked(submitValidationResponse).mockResolvedValue('0xresponse');

    const result = await runWeeklyVerification({
      now: new Date('2026-06-10T12:00:00.000Z'),
      wavScoreFn: async () => ({
        applicable: true,
        risk_score: 12,
        notes: 'ok',
        checks: {},
      }),
      wvScoreFn: async () => ({
        applicable: true,
        risk_score: 18,
        notes: 'ok',
        checks: {},
      }),
    });

    expect(result.ok).toBe(true);
    expect(result.unifiedRiskScore).toBe(15);
    expect(storeTrustVerification).toHaveBeenCalledOnce();
    expect(submitValidationResponse).toHaveBeenCalledOnce();
  });
});
