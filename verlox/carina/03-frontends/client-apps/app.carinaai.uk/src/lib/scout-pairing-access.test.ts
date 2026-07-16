import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertOpsToken, canPairScout } from './scout-pairing-access';

const baseInput = {
  plan: 'starter',
  email: 'owner@example.com',
  userId: 'user-1',
  workspaceId: 'workspace-1',
  scoutPairingAllowed: false,
};

describe('canPairScout', () => {
  it('allows Team workspaces without a bypass', () => {
    expect(canPairScout({ ...baseInput, plan: 'team' })).toEqual({
      allowed: true,
      viaBypass: false,
    });
  });

  it('allows an explicit admin unlock and rejects other plans', () => {
    expect(canPairScout({ ...baseInput, scoutPairingAllowed: true })).toEqual({
      allowed: true,
      viaBypass: true,
    });
    expect(canPairScout(baseInput)).toEqual({ allowed: false, viaBypass: false });
  });
});

describe('assertOpsToken', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('requires the configured ops token', () => {
    vi.stubEnv('CARINA_OPS_TOKEN', 'secret');
    expect(() => assertOpsToken('secret')).not.toThrow();
    expect(() => assertOpsToken('wrong')).toThrow('Invalid ops token');
  });
});
