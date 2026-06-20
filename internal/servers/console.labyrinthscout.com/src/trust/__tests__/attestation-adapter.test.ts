import { describe, expect, it, vi } from 'vitest';
import {
  LabyrinthScoutAttestationAdapter,
  walletToAgentId,
  type TrustSdkLike,
} from '../attestation-adapter.js';
import {
  LABYRINTH_SCOUT_NAMESPACE,
  LABYRINTH_SCOUT_TAGS,
} from '../attestation-namespace.js';

function makeMockSdk(overrides: Partial<TrustSdkLike> = {}): TrustSdkLike {
  return {
    isSchemaActive: vi.fn().mockResolvedValue(true),
    registerSchema: vi.fn().mockResolvedValue('schema-tx'),
    getAgentId: vi.fn().mockResolvedValue(walletToAgentId('0x1111111111111111111111111111111111111111')),
    hasInteracted: vi.fn().mockResolvedValue(false),
    registerInteraction: vi.fn().mockResolvedValue({
      interactionId: '0xabc',
      txHash: '0xdef',
    }),
    getInteractionsBetween: vi.fn().mockResolvedValue([]),
    submitAttestation: vi.fn().mockResolvedValue('0xattestation-tx-hash'),
    ...overrides,
  };
}

describe('LabyrinthScoutAttestationAdapter', () => {
  it('registers schema when namespace is inactive', async () => {
    const sdk = makeMockSdk({
      isSchemaActive: vi.fn().mockResolvedValue(false),
    });
    const adapter = new LabyrinthScoutAttestationAdapter(sdk);

    await adapter.submitSecurityAttestation({
      toAgentWallet: '0x2222222222222222222222222222222222222222',
      periodKey: '2026-06-10',
      fields: {
        securityScore: 90,
        runtimeHours: 720,
        threatsDetected: 0,
        injectionBlocks: 2,
        sandboxViolations: 0,
      },
    });

    expect(sdk.registerSchema).toHaveBeenCalledOnce();
    expect(sdk.submitAttestation).toHaveBeenCalledWith(
      expect.objectContaining({
        namespace: LABYRINTH_SCOUT_NAMESPACE,
        tag: LABYRINTH_SCOUT_TAGS.runtimeClean,
        score: 90,
        interactionId: '0xabc',
      }),
    );
  });

  it('reuses existing interaction when present', async () => {
    const sdk = makeMockSdk({
      getInteractionsBetween: vi.fn().mockResolvedValue(['0xexisting']),
    });
    const adapter = new LabyrinthScoutAttestationAdapter(sdk);

    await adapter.submitSecurityAttestation({
      toAgentWallet: '0x2222222222222222222222222222222222222222',
      periodKey: '2026-06-10',
      fields: {
        securityScore: 75,
        runtimeHours: 120,
        threatsDetected: 1,
        injectionBlocks: 0,
        sandboxViolations: 0,
      },
    });

    expect(sdk.registerInteraction).not.toHaveBeenCalled();
    expect(sdk.submitAttestation).toHaveBeenCalledWith(
      expect.objectContaining({
        tag: LABYRINTH_SCOUT_TAGS.securitySummary,
        interactionId: '0xexisting',
      }),
    );
  });
});

describe('walletToAgentId', () => {
  it('converts checksummed addresses to bigint', () => {
    const id = walletToAgentId('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb');
    expect(id).toBe(BigInt('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'));
  });
});
