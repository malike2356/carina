import { afterEach, describe, expect, it, vi } from 'vitest';
import { readWorkerPlaybook } from './provision-worker-playbook.js';

vi.mock('./worker-bridge-store.js', () => ({
  updateWorkerConfig: vi.fn(async () => undefined),
}));

describe('provision-worker-playbook', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('reads playbook config from worker config', () => {
    const playbook = readWorkerPlaybook({
      playbook: {
        playbookId: 'aiva-deal-analyse',
        keprixGraphId: 'aiva-deal-analyse',
        playbookVariables: { min_score: 65 },
      },
    });
    expect(playbook?.playbookId).toBe('aiva-deal-analyse');
  });

  it('returns null when playbook is missing', () => {
    expect(readWorkerPlaybook({})).toBeNull();
    expect(readWorkerPlaybook(undefined)).toBeNull();
  });
});

describe('provisionWorkerPlaybook', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('writes playbook config via updateWorkerConfig', async () => {
    const { updateWorkerConfig } = await import('./worker-bridge-store.js');
    const { provisionWorkerPlaybook } = await import('./provision-worker-playbook.js');
    const result = await provisionWorkerPlaybook('ws-1', 'worker-1', {
      playbookId: 'aiva-deal-analyse',
    });
    expect(result.playbookId).toBe('aiva-deal-analyse');
    expect(result.inboundTriggers).toContain('email_received');
    expect(updateWorkerConfig).toHaveBeenCalledWith(
      'ws-1',
      'worker-1',
      expect.objectContaining({
        playbook: expect.objectContaining({ playbookId: 'aiva-deal-analyse' }),
      }),
    );
  });
});
