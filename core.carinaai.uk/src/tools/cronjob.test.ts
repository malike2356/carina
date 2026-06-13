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

  it('returns error when schedule is missing on create', async () => {
    const tool = createCronjobTool('sess-1');
    const result = await tool.execute({ action: 'create', prompt: 'do something' });
    expect(result).toEqual({ error: 'schedule is required for create.' });
  });

  it('returns error when schedule format is invalid', async () => {
    parseSchedule.mockImplementation(() => { throw new Error('Unrecognized schedule format: bad-schedule'); });
    const tool = createCronjobTool('sess-1');
    const result = await tool.execute({
      action: 'create',
      schedule: 'bad-schedule',
      prompt: 'do something',
    }) as { error?: string };
    expect(result.error).toContain('Unrecognized schedule format');
  });

  it('list returns mapped jobs array', async () => {
    listJobs.mockResolvedValue([{
      id: 'job-1', name: 'daily', schedule: '0 9 * * *', status: 'active',
      lastRun: null, nextRun: null, deliver: 'origin', deliverChannels: [],
      noAgent: false, contextFrom: [], chainAfter: [], workdir: null,
    }]);
    const tool = createCronjobTool('sess-1');
    const result = await tool.execute({ action: 'list' }) as { jobs: unknown[] };
    expect(result.jobs).toHaveLength(1);
    expect((result.jobs[0] as Record<string, unknown>).job_id).toBe('job-1');
  });

  it('list returns error when DB throws', async () => {
    listJobs.mockRejectedValue(new Error('connection refused'));
    const tool = createCronjobTool('sess-1');
    const result = await tool.execute({ action: 'list' }) as { error?: string };
    expect(result.error).toContain('connection refused');
  });

  it('run calls executeJob and returns output', async () => {
    getJob.mockResolvedValue({ id: 'job-1', status: 'active', name: 'test' });
    executeJob.mockResolvedValue('script ran ok');
    const tool = createCronjobTool('sess-1');
    const result = await tool.execute({ action: 'run', job_id: 'job-1' }) as { output?: string };
    expect(executeJob).toHaveBeenCalledWith('job-1');
    expect(result.output).toBe('script ran ok');
  });

  it('run returns error when executeJob throws', async () => {
    getJob.mockResolvedValue({ id: 'job-1', status: 'active' });
    executeJob.mockRejectedValue(new Error('Script exited with code 1: permission denied'));
    const tool = createCronjobTool('sess-1');
    const result = await tool.execute({ action: 'run', job_id: 'job-1' }) as { error?: string };
    expect(result.error).toContain('Script exited');
  });

  it('returns error when job_id is missing for remove', async () => {
    const tool = createCronjobTool('sess-1');
    const result = await tool.execute({ action: 'remove' }) as { error?: string };
    expect(result.error).toContain('job_id');
  });

  it('remove returns removed status', async () => {
    removeJob.mockResolvedValue(true);
    const tool = createCronjobTool('sess-1');
    const result = await tool.execute({ action: 'remove', job_id: 'job-1' }) as { status?: string };
    expect(result.status).toBe('removed');
  });

  it('pause returns paused status', async () => {
    updateJob.mockResolvedValue({ id: 'job-1', status: 'paused' });
    const tool = createCronjobTool('sess-1');
    const result = await tool.execute({ action: 'pause', job_id: 'job-1' }) as { status?: string };
    expect(result.status).toBe('paused');
  });
});
