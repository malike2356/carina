import express from 'express';
import { describe, expect, it, vi, beforeEach } from 'vitest';

describe('scheduled-api', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns status summary', async () => {
    vi.doMock('../memory/db.js', () => ({
      initDb: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('../agents/cron-scheduler.js', () => ({
      listJobs: vi.fn().mockResolvedValue([
        { id: 'job-1', name: 'Daily', schedule: '0 9 * * *', prompt: 'hi', status: 'active', lastRun: null, nextRun: null, deliver: 'none', profileName: 'default', createdAt: new Date('2026-06-01') },
      ]),
    }));
    vi.doMock('../ops/taskflows/index.js', () => ({
      taskFlowsEnabled: () => true,
      taskFlowWorkerEnabled: () => true,
      listTaskFlows: () => [{ id: 'f1', name: 'flow', status: 'active', steps: [], triggers: [] }],
      listTaskFlowRuns: () => [],
      summarizeTaskFlowRuns: () => ({
        queued: 0, running: 0, succeeded: 1, failed: 0, timed_out: 0, cancelled: 0, lost: 0,
      }),
      triggerTaskFlow: vi.fn(),
      executeTaskFlowRun: vi.fn(),
      pauseTaskFlow: vi.fn(),
      resumeTaskFlow: vi.fn(),
      cancelTaskFlowRun: vi.fn(),
    }));
    vi.doMock('../infrastructure/control-auth.js', () => ({
      isControlAuthorized: () => true,
    }));

    const { scheduledApiRouter } = await import('./scheduled-api.js');
    const app = express();
    app.use('/api/scheduled', scheduledApiRouter);

    await new Promise<void>((resolve) => {
      const server = app.listen(0, async () => {
        const port = (server.address() as { port: number }).port;
        const res = await fetch(`http://127.0.0.1:${port}/api/scheduled/status`);
        const data = await res.json() as { taskflowsEnabled: boolean; cronJobs: number; flows: number };
        expect(res.status).toBe(200);
        expect(data.taskflowsEnabled).toBe(true);
        expect(data.cronJobs).toBe(1);
        expect(data.flows).toBe(1);
        server.close(() => resolve());
      });
    });
  });

  it('lists cron jobs without internal fields', async () => {
    vi.doMock('../memory/db.js', () => ({
      initDb: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('../agents/cron-scheduler.js', () => ({
      listJobs: vi.fn().mockResolvedValue([
        {
          id: 'job-1',
          name: 'Daily',
          schedule: '0 9 * * *',
          prompt: 'Summarize inbox',
          status: 'active',
          lastRun: new Date('2026-06-15T09:00:00.000Z'),
          nextRun: new Date('2026-06-16T09:00:00.000Z'),
          deliver: 'none',
          profileName: 'default',
          createdAt: new Date('2026-06-01'),
        },
      ]),
      updateJob: vi.fn(),
    }));
    vi.doMock('../ops/taskflows/index.js', () => ({
      listTaskFlows: () => [],
      listTaskFlowRuns: () => [],
      summarizeTaskFlowRuns: () => ({
        queued: 0, running: 0, succeeded: 0, failed: 0, timed_out: 0, cancelled: 0, lost: 0,
      }),
      taskFlowsEnabled: () => true,
      taskFlowWorkerEnabled: () => true,
      triggerTaskFlow: vi.fn(),
      executeTaskFlowRun: vi.fn(),
      pauseTaskFlow: vi.fn(),
      resumeTaskFlow: vi.fn(),
      cancelTaskFlowRun: vi.fn(),
    }));
    vi.doMock('../infrastructure/control-auth.js', () => ({
      isControlAuthorized: () => true,
    }));

    const { scheduledApiRouter } = await import('./scheduled-api.js');
    const app = express();
    app.use('/api/scheduled', scheduledApiRouter);

    await new Promise<void>((resolve) => {
      const server = app.listen(0, async () => {
        const port = (server.address() as { port: number }).port;
        const res = await fetch(`http://127.0.0.1:${port}/api/scheduled/cron`);
        const data = await res.json() as { jobs: Array<{ id: string; schedule: string }> };
        expect(res.status).toBe(200);
        expect(data.jobs[0]?.id).toBe('job-1');
        expect(data.jobs[0]?.schedule).toBe('0 9 * * *');
        server.close(() => resolve());
      });
    });
  });

  it('creates, updates, runs, and deletes cron jobs', async () => {
    vi.doMock('../memory/db.js', () => ({
      initDb: vi.fn().mockResolvedValue(undefined),
    }));
    const createJob = vi.fn().mockResolvedValue({
      id: 'job-2',
      name: 'Daily',
      schedule: '0 9 * * *',
      prompt: 'Summarize inbox',
      scriptPath: null,
      noAgent: false,
      deliver: 'origin',
      repeatCount: null,
      runsRemaining: null,
      status: 'active',
      lastRun: null,
      nextRun: null,
      contextFrom: [],
      chainAfter: [],
      enabledToolsets: [],
      workdir: null,
      originSessionId: null,
      originChannel: null,
      originConversationId: null,
      originThreadId: null,
      deliverChannels: [],
      profileName: 'default',
      modelProvider: null,
      modelName: null,
      failureLimit: 3,
      failureCount: 0,
      createdAt: new Date('2026-06-01'),
    });
    const updatedJob = {
      id: 'job-1',
      name: 'Updated',
      schedule: '0 8 * * *',
      prompt: 'Updated prompt',
      scriptPath: null,
      noAgent: false,
      deliver: 'origin',
      repeatCount: null,
      runsRemaining: null,
      status: 'active',
      lastRun: new Date('2026-06-16T08:00:00.000Z'),
      nextRun: new Date('2026-06-17T08:00:00.000Z'),
      contextFrom: [],
      chainAfter: [],
      enabledToolsets: [],
      workdir: null,
      originSessionId: null,
      originChannel: null,
      originConversationId: null,
      originThreadId: null,
      deliverChannels: [],
      profileName: 'default',
      modelProvider: null,
      modelName: null,
      failureLimit: 3,
      failureCount: 0,
      createdAt: new Date('2026-06-01'),
    };
    const getJob = vi.fn().mockResolvedValue(updatedJob);
    vi.doMock('../agents/cron-scheduler.js', () => ({
      listJobs: vi.fn().mockResolvedValue([updatedJob]),
      createJob,
      updateJob: vi.fn().mockResolvedValue(updatedJob),
      removeJob: vi.fn().mockResolvedValue(true),
      executeJob: vi.fn().mockResolvedValue('Run output'),
      getJob,
      parseSchedule: vi.fn(),
    }));
    vi.doMock('../agents/job-history.js', () => ({
      listCronJobHistory: vi.fn().mockResolvedValue([
        {
          id: 'run-1',
          jobId: 'job-1',
          output: 'Run output',
          success: true,
          completedAt: '2026-06-16T08:00:00.000Z',
        },
      ]),
    }));
    vi.doMock('../ops/taskflows/index.js', () => ({
      listTaskFlows: () => [],
      listTaskFlowRuns: () => [],
      summarizeTaskFlowRuns: () => ({
        queued: 0, running: 0, succeeded: 0, failed: 0, timed_out: 0, cancelled: 0, lost: 0,
      }),
      taskFlowsEnabled: () => true,
      taskFlowWorkerEnabled: () => true,
      triggerTaskFlow: vi.fn(),
      executeTaskFlowRun: vi.fn(),
      pauseTaskFlow: vi.fn(),
      resumeTaskFlow: vi.fn(),
      cancelTaskFlowRun: vi.fn(),
    }));
    vi.doMock('../infrastructure/control-auth.js', () => ({
      isControlAuthorized: () => true,
    }));

    const { scheduledApiRouter } = await import('./scheduled-api.js');
    const app = express();
    app.use(express.json());
    app.use('/api/scheduled', scheduledApiRouter);

    await new Promise<void>((resolve) => {
      const server = app.listen(0, async () => {
        const port = (server.address() as { port: number }).port;

        const createRes = await fetch(`http://127.0.0.1:${port}/api/scheduled/cron`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schedule: '0 9 * * *', name: 'Daily', prompt: 'Summarize inbox' }),
        });
        expect(createRes.status).toBe(201);
        const created = await createRes.json() as { job: { id: string } };
        expect(created.job.id).toBe('job-2');

        const updateRes = await fetch(`http://127.0.0.1:${port}/api/scheduled/cron/job-1`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schedule: '0 8 * * *', name: 'Updated' }),
        });
        expect(updateRes.status).toBe(200);

        const runRes = await fetch(`http://127.0.0.1:${port}/api/scheduled/cron/job-1/run`, {
          method: 'POST',
        });
        expect(runRes.status).toBe(202);

        const historyRes = await fetch(`http://127.0.0.1:${port}/api/scheduled/cron/job-1/history`);
        const history = await historyRes.json() as { history: Array<{ id: string }> };
        expect(historyRes.status).toBe(200);
        expect(history.history[0]?.id).toBe('run-1');

        const deleteRes = await fetch(`http://127.0.0.1:${port}/api/scheduled/cron/job-1`, {
          method: 'DELETE',
        });
        expect(deleteRes.status).toBe(200);

        server.close(() => resolve());
      });
    });
  });
});
