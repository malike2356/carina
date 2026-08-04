import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { EventEntity } from '@paddle/paddle-node-sdk';
import { handlePaddleEvent } from '../paddle-webhook-handler.js';

const upsertMock = vi.fn(async () => undefined);
const suspendMock = vi.fn(async () => undefined);
const reactivateMock = vi.fn(async () => undefined);
const getByPaddleIdMock = vi.fn(async () => null);

vi.mock('../paddle-subscription-store.js', () => ({
  upsertPaddleSubscription: (...args: unknown[]) => upsertMock(...args),
  suspendPaddleWorkspace: (...args: unknown[]) => suspendMock(...args),
  reactivatePaddleWorkspace: (...args: unknown[]) => reactivateMock(...args),
  getPaddleSubscriptionByPaddleId: (...args: unknown[]) => getByPaddleIdMock(...args),
}));

function event(
  eventType: string,
  data: Record<string, unknown>,
): EventEntity {
  return { eventType, data } as EventEntity;
}

describe('handlePaddleEvent', () => {
  beforeEach(() => {
    upsertMock.mockClear();
    suspendMock.mockClear();
    reactivateMock.mockClear();
    getByPaddleIdMock.mockClear();
  });

  it('subscription.created upserts an active business subscription', async () => {
    await handlePaddleEvent(event('subscription.created', {
      id: 'sub_01',
      customerId: 'ctm_01',
      status: 'active',
      customData: { workspaceId: 'ws-1' },
      currentBillingPeriod: { endsAt: '2026-08-04T00:00:00Z' },
    }));

    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: 'ws-1',
      paddleSubscriptionId: 'sub_01',
      status: 'active',
      planTier: 'business',
    }));
  });

  it('subscription.canceled suspends the workspace', async () => {
    await handlePaddleEvent(event('subscription.canceled', {
      id: 'sub_01',
      customData: { workspaceId: 'ws-2' },
    }));

    expect(suspendMock).toHaveBeenCalledWith('ws-2');
  });

  it('transaction.payment_failed suspends the workspace', async () => {
    await handlePaddleEvent(event('transaction.payment_failed', {
      subscriptionId: 'sub_03',
      customData: { workspaceId: 'ws-3' },
    }));

    expect(suspendMock).toHaveBeenCalledWith('ws-3');
  });

  it('returns without throwing when workspaceId is missing', async () => {
    await expect(handlePaddleEvent(event('subscription.created', {
      id: 'sub_04',
      status: 'active',
    }))).resolves.toBeUndefined();
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('ignores unknown event types', async () => {
    await expect(handlePaddleEvent(event('price.updated', {
      customData: { workspaceId: 'ws-5' },
    }))).resolves.toBeUndefined();
    expect(upsertMock).not.toHaveBeenCalled();
    expect(suspendMock).not.toHaveBeenCalled();
  });
});
