import { afterEach, describe, expect, it, vi } from 'vitest';
import { onWorkerInboundEvent } from './worker-playbook-triggers.js';

vi.mock('./worker-store.js', () => ({
  getWorkerById: vi.fn(),
  logActivity: vi.fn(async () => undefined),
}));

vi.mock('./worker-bridge-store.js', () => ({
  updateWorkerConfig: vi.fn(async () => undefined),
}));

vi.mock('./playbook-run-client.js', () => ({
  startWorkerPlaybookRun: vi.fn(async () => ({
    runId: 'run-1',
    graphId: 'aiva-deal-analyse',
    status: 'running',
    workspaceId: 'ws-1',
  })),
  buildKeprixRunUrl: vi.fn((id: string) => `https://studio.example/playbooks/${id}`),
}));

describe('worker-playbook-triggers', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('skips when worker has no playbook', async () => {
    const { getWorkerById } = await import('./worker-store.js');
    vi.mocked(getWorkerById).mockResolvedValue({
      id: 'w1',
      workspaceId: 'ws-1',
      status: 'active',
      workerConfig: {},
    } as never);
    const result = await onWorkerInboundEvent('w1', {
      type: 'email_received',
      payload: { subject: 'Deal pack' },
    });
    expect(result.skipped).toBe('no_playbook');
  });

  it('starts run on configured inbound trigger', async () => {
    const { getWorkerById } = await import('./worker-store.js');
    const { startWorkerPlaybookRun } = await import('./playbook-run-client.js');
    vi.mocked(getWorkerById).mockResolvedValue({
      id: 'w1',
      workspaceId: 'ws-1',
      status: 'active',
      workerConfig: {
        playbook: {
          playbookId: 'aiva-deal-analyse',
          inboundTriggers: ['email_received'],
        },
      },
    } as never);
    const result = await onWorkerInboundEvent('w1', {
      type: 'email_received',
      payload: { subject: 'Deal pack' },
    });
    expect(result.runId).toBe('run-1');
    expect(startWorkerPlaybookRun).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: 'inbound', workerId: 'w1' }),
    );
  });
});
