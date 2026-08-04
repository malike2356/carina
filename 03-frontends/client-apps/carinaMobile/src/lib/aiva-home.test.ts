import { describe, expect, it } from 'vitest';
import type { AivaWorkerSummary } from '@/api/aiva-client';
import {
  buildAivaCreditHint,
  greetingNameFromEmail,
  mapAivaWorkersToListItems,
  resolveAivaListView,
  resolveAivaNextAction,
} from './aiva-home';

function worker(partial: Partial<AivaWorkerSummary> & { id: string; name: string }): AivaWorkerSummary {
  return {
    workspaceId: 'ws1',
    roleDescription: 'Support',
    status: 'active',
    channels: [],
    language: 'en-GB',
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-01T10:00:00.000Z',
    ...partial,
  };
}

describe('resolveAivaNextAction', () => {
  it('returns hire when there are zero workers', () => {
    const action = resolveAivaNextAction([]);
    expect(action.kind).toBe('hire');
    expect(action.label).toMatch(/Hire/i);
  });

  it('opens the latest updated worker when several exist', () => {
    const action = resolveAivaNextAction([
      worker({
        id: 'old',
        name: 'Old',
        updatedAt: '2026-07-01T10:00:00.000Z',
      }),
      worker({
        id: 'new',
        name: 'Nova',
        updatedAt: '2026-07-10T12:00:00.000Z',
      }),
    ]);
    expect(action).toMatchObject({
      kind: 'open',
      workerId: 'new',
      workerName: 'Nova',
    });
  });
});

describe('mapAivaWorkersToListItems', () => {
  it('maps active, paused, and error statuses and drops dismissed', () => {
    const items = mapAivaWorkersToListItems([
      worker({ id: '1', name: 'Active one', status: 'active', channels: ['email', 'slack'] }),
      worker({ id: '2', name: 'Paused one', status: 'paused', channels: ['telegram'] }),
      worker({ id: '3', name: 'Broken', status: 'error', channels: [] }),
      worker({ id: '4', name: 'Gone', status: 'dismissed', channels: [] }),
    ]);
    expect(items).toHaveLength(3);
    expect(items.find((item) => item.id === '1')).toMatchObject({
      statusLabel: 'Active',
      channelCount: 2,
    });
    expect(items.find((item) => item.id === '2')?.statusLabel).toBe('Paused');
    expect(items.find((item) => item.id === '3')?.statusLabel).toBe('Needs attention');
    expect(items.some((item) => item.id === '4')).toBe(false);
  });
});

describe('resolveAivaListView', () => {
  it('returns loading for idle and loading phases', () => {
    expect(resolveAivaListView({
      phase: 'loading',
      workers: [],
      error: null,
      sessionExpired: false,
      planGate: false,
    }).kind).toBe('loading');
  });

  it('returns error reducer fields', () => {
    const view = resolveAivaListView({
      phase: 'error',
      workers: [],
      error: 'Network request failed',
      sessionExpired: false,
      planGate: false,
    });
    expect(view).toEqual({
      kind: 'error',
      message: 'Network request failed',
      sessionExpired: false,
      planGate: false,
    });
  });

  it('returns empty when ready with no active workers', () => {
    const view = resolveAivaListView({
      phase: 'ready',
      workers: [worker({ id: 'x', name: 'Gone', status: 'dismissed' })],
      error: null,
      sessionExpired: false,
      planGate: false,
    });
    expect(view.kind).toBe('empty');
  });

  it('returns ready list items', () => {
    const view = resolveAivaListView({
      phase: 'ready',
      workers: [worker({ id: '1', name: 'Sam', channels: ['email'] })],
      error: null,
      sessionExpired: false,
      planGate: false,
    });
    expect(view.kind).toBe('ready');
    if (view.kind === 'ready') {
      expect(view.workers[0]?.name).toBe('Sam');
    }
  });
});

describe('buildAivaCreditHint / greeting', () => {
  it('surfaces trial and soft-wall hints', () => {
    expect(
      buildAivaCreditHint({
        planTier: 'trial',
        status: 'trialing',
        trialEndsAt: null,
        trialDaysRemaining: 3,
        slotLimit: 1,
        aivasUsed: 0,
        canHireMore: true,
      }),
    ).toMatch(/3 days remaining/i);

    expect(
      buildAivaCreditHint({
        planTier: 'starter',
        status: 'active',
        trialEndsAt: null,
        trialDaysRemaining: null,
        slotLimit: 1,
        aivasUsed: 1,
        canHireMore: false,
        softWall: true,
      }),
    ).toMatch(/exhausted/i);
  });

  it('derives greeting from email local part', () => {
    expect(greetingNameFromEmail('malike@example.com')).toBe('malike');
    expect(greetingNameFromEmail(null)).toBe('there');
  });
});
