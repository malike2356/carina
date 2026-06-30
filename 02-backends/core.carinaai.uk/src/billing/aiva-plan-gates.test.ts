import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STARTER_CHANNEL_LIMIT,
  channelLimitForTier,
} from './aiva-plan-gates.js';

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

  it('limits channels by tier per pricing-strategy.md', () => {
    expect(channelLimitForTier('trial')).toBe(STARTER_CHANNEL_LIMIT);
    expect(channelLimitForTier('starter')).toBe(STARTER_CHANNEL_LIMIT);
    expect(channelLimitForTier('growth')).toBe(10);
    expect(channelLimitForTier('team')).toBe(10);
    expect(channelLimitForTier('business')).toBe(10);
  });
});
