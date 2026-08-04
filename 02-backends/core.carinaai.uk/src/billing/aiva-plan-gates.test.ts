import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertCanUseCustomDomain,
  channelLimitForTier,
} from './aiva-plan-gates.js';
import { slotLimitForTier, tierAllowsCustomDomain } from './aiva-tier.js';

const getSubscriptionMock = vi.fn();
const getWorkerMock = vi.fn();
const listWorkerChannelDetailsMock = vi.fn();

vi.mock('../workers/aiva-subscription-store.js', () => ({
  getSubscription: (...args: unknown[]) => getSubscriptionMock(...args),
}));

vi.mock('../workers/worker-store.js', () => ({
  getWorker: (...args: unknown[]) => getWorkerMock(...args),
}));

vi.mock('../channels/channel-store.js', () => ({
  listWorkerChannelDetails: (...args: unknown[]) => listWorkerChannelDetailsMock(...args),
}));

describe('aiva-plan-gates', () => {
  beforeEach(() => {
    getSubscriptionMock.mockReset();
    getWorkerMock.mockReset();
    listWorkerChannelDetailsMock.mockReset();
  });

  it('does not limit channels by billing tier', () => {
    expect(channelLimitForTier('trial')).toBeNull();
    expect(channelLimitForTier('starter')).toBeNull();
    expect(channelLimitForTier('growth')).toBeNull();
    expect(channelLimitForTier('team')).toBeNull();
    expect(channelLimitForTier('business')).toBeNull();
  });

  it('resolveWorkspacePlanTier grants growth limits during active trial', async () => {
    getSubscriptionMock.mockResolvedValue({ planTier: 'trial', status: 'trialing' });
    const { resolveWorkspacePlanTier } = await import('./aiva-plan-gates.js');
    await expect(resolveWorkspacePlanTier('ws-trial')).resolves.toBe('growth');
    expect(channelLimitForTier(await resolveWorkspacePlanTier('ws-trial'))).toBeNull();
  });

  it('gives business an unlimited slot limit', () => {
    expect(slotLimitForTier('business')).toBeNull();
    expect(slotLimitForTier('starter')).toBe(1);
    expect(slotLimitForTier('growth')).toBe(5);
  });

  it('gates custom domain to the business tier', () => {
    expect(tierAllowsCustomDomain('business')).toBe(true);
    expect(tierAllowsCustomDomain('growth')).toBe(false);
    expect(tierAllowsCustomDomain('starter')).toBe(false);
  });

  it('assertCanUseCustomDomain resolves for business workspaces', async () => {
    getSubscriptionMock.mockResolvedValue({ planTier: 'business' });
    await expect(assertCanUseCustomDomain('ws-1')).resolves.toBeUndefined();
  });

  it('assertCanUseCustomDomain throws 403 for growth workspaces', async () => {
    getSubscriptionMock.mockResolvedValue({ planTier: 'growth' });
    await expect(assertCanUseCustomDomain('ws-1')).rejects.toMatchObject({
      status: 403,
      code: 'CUSTOM_DOMAIN_PLAN_GATE',
    });
  });
});
