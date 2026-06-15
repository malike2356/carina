import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronWorkflow, CronWorkflowDefinition } from './cron-workflow-types.js';

const workflowDef: CronWorkflowDefinition = {
  version: 1,
  steps: [
    { id: 'fetch', prompt: 'fetch data', deliver: false },
    { id: 'summarize', prompt: 'summarize', needs: ['fetch'], retries: 1, retryDelayMs: 1 },
    { id: 'notify', prompt: 'notify', needs: ['summarize'], deliver: ['telegram:99'] },
  ],
  deliverOn: 'last',
  onFailure: { deliver: 'origin', message: 'failed at {{step}}' },
};

const workflow: CronWorkflow = {
  id: 'wf-1',
  name: 'daily',
  schedule: '30m',
  definition: workflowDef,
  deliver: 'origin',
  deliverChannels: [],
  status: 'active',
  workdir: null,
  originSessionId: 'sess-1',
  originChannel: 'telegram',
  originConversationId: '1',
  originThreadId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const { runCronStep, deliverJobOutput, store } = vi.hoisted(() => ({
  runCronStep: vi.fn(),
  deliverJobOutput: vi.fn(),
  store: {
    getWorkflow: vi.fn(),
    createWorkflowRun: vi.fn(),
    getWorkflowRun: vi.fn(),
    patchWorkflowRun: vi.fn(),
  },
}));

vi.mock('./cron-step-runner.js', () => ({
  runCronStep,
  sleep: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./cron-delivery.js', () => ({
  deliverJobOutput,
}));

vi.mock('./cron-workflow-store.js', () => store);

vi.mock('../webhooks/dispatcher.js', () => ({
  dispatchWebhook: vi.fn(),
}));

const { executeWorkflow } = await import('./cron-workflow-engine.js');

describe('cron-workflow-engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.getWorkflow.mockResolvedValue(workflow);
    store.createWorkflowRun.mockResolvedValue({
      id: 'run-1',
      workflowId: 'wf-1',
      status: 'queued',
      currentStepId: null,
      stepStates: {},
      context: {},
      error: null,
      startedAt: null,
      finishedAt: null,
      createdAt: new Date(),
    });
    store.patchWorkflowRun.mockImplementation(async (_id, patch) => ({
      id: 'run-1',
      workflowId: 'wf-1',
      status: patch.status ?? 'running',
      currentStepId: patch.currentStepId ?? null,
      stepStates: patch.stepStates ?? {},
      context: patch.context ?? {},
      error: patch.error ?? null,
      startedAt: new Date(),
      finishedAt: patch.finishedAt ?? null,
      createdAt: new Date(),
    }));
    deliverJobOutput.mockResolvedValue(['telegram:99']);
  });

  it('runs linear chain and delivers final output', async () => {
    runCronStep
      .mockResolvedValueOnce({ output: 'raw data', success: true })
      .mockResolvedValueOnce({ output: 'summary text', success: true })
      .mockResolvedValueOnce({ output: 'done', success: true });

    const result = await executeWorkflow('wf-1');

    expect(result.status).toBe('succeeded');
    expect(runCronStep).toHaveBeenCalledTimes(3);
    expect(deliverJobOutput).toHaveBeenCalled();
    expect(result.output).toBe('done');
  });

  it('stops chain on failure and delivers failure notice', async () => {
    runCronStep
      .mockResolvedValueOnce({ output: 'raw data', success: true })
      .mockResolvedValueOnce({ output: '', success: false, error: 'model timeout' })
      .mockResolvedValueOnce({ output: '', success: false, error: 'retry fail' });

    const result = await executeWorkflow('wf-1');

    expect(result.status).toBe('failed');
    expect(runCronStep).toHaveBeenCalledTimes(3);
    expect(deliverJobOutput).toHaveBeenCalledWith(
      expect.objectContaining({ deliver: 'origin' }),
      expect.stringContaining('summarize'),
    );
  });

  it('retries failed step before branching failure', async () => {
    runCronStep
      .mockResolvedValueOnce({ output: 'raw', success: true })
      .mockResolvedValueOnce({ output: '', success: false, error: 'transient' })
      .mockResolvedValueOnce({ output: 'summary ok', success: true })
      .mockResolvedValueOnce({ output: 'sent', success: true });

    const result = await executeWorkflow('wf-1');

    expect(result.status).toBe('succeeded');
    expect(runCronStep).toHaveBeenCalledTimes(4);
  });

  it('passes scoped context without unrelated state', async () => {
    runCronStep.mockResolvedValue({ output: 'ok', success: true });

    await executeWorkflow('wf-1');

    const summarizeCall = runCronStep.mock.calls.find((c) => String(c[0]?.jobId).includes('summarize'));
    expect(summarizeCall?.[0]?.contextPrefix).toContain('[Step fetch]');
    expect(summarizeCall?.[0]?.contextPrefix).not.toContain('[Step notify]');
  });
});
