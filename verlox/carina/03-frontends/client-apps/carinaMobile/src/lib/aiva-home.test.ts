import { describe, expect, it } from 'vitest';
import type { AivaWorkerSummary } from '@/api/aiva-client';
import {
  buildAivaCreditHint,
  mapAivaWorkersToListItems,
  resolveAivaListView,
  resolveAivaNextAction,
} from './aiva-home';

function worker(id: string, status: string, updatedAt: string): AivaWorkerSummary {
  return {
    id,
    workspaceId: 'workspace',
    name: `Worker ${id}`,
    roleDescription: 'Support',
    status,
    channels: ['email'],
    language: 'en-GB',
    createdAt: updatedAt,
    updatedAt,
  };
}

describe('aiva home helpers', () => {
  it('filters dismissed workers and orders newest first', () => {
    const workers = [
      worker('old', 'active', '2026-07-15T10:00:00.000Z'),
      worker('new', 'paused', '2026-07-16T10:00:00.000Z'),
      worker('gone', 'dismissed', '2026-07-17T10:00:00.000Z'),
    ];

    expect(mapAivaWorkersToListItems(workers).map((item) => item.id)).toEqual(['new', 'old']);
    expect(resolveAivaNextAction(workers)).toMatchObject({ kind: 'open', workerId: 'new' });
  });

  it('resolves empty state and managed credit hints', () => {
    expect(resolveAivaListView({
      phase: 'ready',
      workers: [],
      error: null,
      sessionExpired: false,
      planGate: false,
    }).kind).toBe('empty');
    expect(buildAivaCreditHint({
      planTier: 'trial',
      status: 'trialing',
      trialEndsAt: null,
      trialDaysRemaining: 2,
      slotLimit: 1,
      aivasUsed: 1,
      canHireMore: false,
    })).toBe('Trial: 2 days remaining.');
  });
});
