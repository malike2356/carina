import { describe, expect, it } from 'vitest';
import type { AivaWorkerDetail } from '@/api/aiva-client';
import {
  applyWorkerStatus,
  buildAivaUsageGlance,
  mapAivaStatusChip,
  mapAivaWorkerDetailOverview,
  nextPauseResumeStatus,
  resolvePauseResumeStatus,
} from './aiva-employee-detail';

function detail(partial: Partial<AivaWorkerDetail> = {}): AivaWorkerDetail {
  return {
    id: 'w1',
    workspaceId: 'ws1',
    name: 'Alex Support',
    roleDescription: 'Inbox triage',
    status: 'active',
    channels: ['email'],
    language: 'en-GB',
    createdAt: null,
    updatedAt: null,
    messagesToday: 4,
    totalMessages: 40,
    pendingApprovals: 1,
    openEscalations: 0,
    lastActiveAt: '2026-07-11T10:00:00.000Z',
    ...partial,
  };
}

describe('mapAivaWorkerDetailOverview', () => {
  it('maps worker detail fields and initials', () => {
    const overview = mapAivaWorkerDetailOverview(detail());
    expect(overview).toMatchObject({
      id: 'w1',
      name: 'Alex Support',
      initials: 'AS',
      messagesToday: 4,
      canPause: true,
      canResume: false,
    });
    expect(overview.chip.label).toBe('Active');
  });
});

describe('mapAivaStatusChip', () => {
  it('maps active, paused, and error tones', () => {
    expect(mapAivaStatusChip('active').tone).toBe('success');
    expect(mapAivaStatusChip('paused').tone).toBe('warning');
    expect(mapAivaStatusChip('error').tone).toBe('danger');
    expect(mapAivaStatusChip('paused').label).toBe('Paused');
  });
});

describe('pause/resume state machine', () => {
  it('computes optimistic next status', () => {
    expect(nextPauseResumeStatus('active', 'pause')).toBe('paused');
    expect(nextPauseResumeStatus('paused', 'resume')).toBe('active');
  });

  it('keeps server status on success', () => {
    expect(
      resolvePauseResumeStatus({
        previous: 'active',
        action: 'pause',
        outcome: 'success',
        serverStatus: 'paused',
      }),
    ).toBe('paused');
  });

  it('rolls back to previous status on failure', () => {
    expect(
      resolvePauseResumeStatus({
        previous: 'active',
        action: 'pause',
        outcome: 'failure',
      }),
    ).toBe('active');

    const rolled = applyWorkerStatus(
      detail({ status: 'paused' }),
      resolvePauseResumeStatus({
        previous: 'active',
        action: 'pause',
        outcome: 'failure',
      }),
    );
    expect(rolled.status).toBe('active');
  });
});

describe('buildAivaUsageGlance', () => {
  it('includes credit line from subscription when present', () => {
    const glance = buildAivaUsageGlance(detail(), {
      planTier: 'starter',
      status: 'active',
      trialEndsAt: null,
      trialDaysRemaining: null,
      slotLimit: 3,
      aivasUsed: 1,
      canHireMore: true,
      walletRemainingGbp: 12.5,
    });
    expect(glance.messagesToday).toBe(4);
    expect(glance.creditLine).toMatch(/£12\.50/);
  });
});
