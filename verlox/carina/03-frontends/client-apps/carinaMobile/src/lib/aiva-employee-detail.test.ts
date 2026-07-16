import { describe, expect, it } from 'vitest';
import type { AivaWorkerDetail } from '@/api/aiva-client';
import {
  initialsFromName,
  mapAivaStatusChip,
  mapAivaWorkerDetailOverview,
  resolvePauseResumeStatus,
} from './aiva-employee-detail';

const WORKER: AivaWorkerDetail = {
  id: 'worker-1',
  workspaceId: 'workspace-1',
  name: 'Ava Smith',
  roleDescription: 'Support',
  status: 'active',
  channels: ['email'],
  language: 'en-GB',
  createdAt: null,
  updatedAt: null,
};

describe('aiva employee detail helpers', () => {
  it('maps worker status and overview controls', () => {
    expect(initialsFromName('Ava Smith')).toBe('AS');
    expect(mapAivaStatusChip('suspended_by_scout').tone).toBe('danger');
    expect(mapAivaWorkerDetailOverview(WORKER)).toMatchObject({
      initials: 'AS',
      canPause: true,
      canResume: false,
      messagesToday: 0,
    });
  });

  it('rolls optimistic status back after a failed action', () => {
    expect(resolvePauseResumeStatus({
      previous: 'active',
      action: 'pause',
      outcome: 'failure',
    })).toBe('active');
    expect(resolvePauseResumeStatus({
      previous: 'active',
      action: 'pause',
      outcome: 'success',
    })).toBe('paused');
  });
});
