import { describe, expect, it, vi, beforeEach } from 'vitest';

const {
  createJob,
  listJobs,
  getJob,
  updateJob,
  removeJob,
  executeJob,
  parseSchedule,
  getSessionDelivery,
} = vi.hoisted(() => ({
  createJob: vi.fn(),
  listJobs: vi.fn(),
  getJob: vi.fn(),
  updateJob: vi.fn(),
  removeJob: vi.fn(),
  executeJob: vi.fn(),
  parseSchedule: vi.fn(),
  getSessionDelivery: vi.fn(),
}));

vi.mock('../agents/cron-scheduler.js', () => ({
  createJob,
  listJobs,
  getJob,
  updateJob,
  removeJob,
  executeJob,
  parseSchedule,
}));

vi.mock('../agents/cron-delivery-registry.js', () => ({
  getSessionDelivery,
}));

import { createCronjobTool } from './cronjob.js';

describe('cronjob tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parseSchedule.mockReturnValue({ cronExpr: '*/30 * * * *' });
    getSessionDelivery.mockReturnValue({
      channel: 'telegram',
      conversationId: '42',
      threadId: '7',
    });
    createJob.mockResolvedValue({ id: 'job-1', status: 'active', schedule: '30m' });
  });

  it('requires script for script-only mode', async () => {
    const tool = createCronjobTool('sess-1');
    const result = await tool.execute({
      action: 'create',
      schedule: '30m',
      no_agent: true,
    });
    expect(result).toEqual({ error: 'script is required when no_agent is true (script-only mode).' });
  });

  it('creates job with origin delivery metadata', async () => {
    const tool = createCronjobTool('sess-1');
    await tool.execute({
      action: 'create',
      schedule: '30m',
      script: 'data/scripts/health.sh',
      no_agent: true,
      deliver_channels: ['discord:99', 'slack:C1'],
    });

    expect(createJob).toHaveBeenCalledWith(expect.objectContaining({
      noAgent: true,
      scriptPath: 'data/scripts/health.sh',
      originChannel: 'telegram',
      originConversationId: '42',
      originThreadId: '7',
      deliverChannels: ['discord:99', 'slack:C1'],
      deliver: 'origin',
    }));
  });

  it('allows prompt plus script for agent mode with script context', async () => {
    const tool = createCronjobTool('sess-1');
    await tool.execute({
      action: 'create',
      schedule: '0 9 * * *',
      prompt: 'Summarize script output',
      script: 'data/scripts/collect.py',
      workdir: '~/projects/demo',
    });

    expect(createJob).toHaveBeenCalledWith(expect.objectContaining({
      prompt: 'Summarize script output',
      scriptPath: 'data/scripts/collect.py',
      workdir: '~/projects/demo',
      noAgent: false,
    }));
  });
});
