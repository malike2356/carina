import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('taskflows engine', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-tf-engine-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.stubEnv('CARINA_TASKFLOWS_ENABLED', 'true');
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('executes delay steps to succeeded', async () => {
    const { upsertTaskFlow, enqueueTaskFlowRun } = await import('./store.js');
    const { executeTaskFlowRun } = await import('./engine.js');
    const flow = upsertTaskFlow({
      name: 'delay-flow',
      steps: [{ type: 'delay', ms: 5 }],
      chainOnSuccess: [],
      status: 'active',
    });
    const run = enqueueTaskFlowRun(flow.id)!;
    const finished = await executeTaskFlowRun(run.id);
    expect(finished?.status).toBe('succeeded');
    expect(finished?.output).toContain('delayed');
  });

  it('triggers flows with cron job id', async () => {
    const { upsertTaskFlow, listTaskFlowRuns } = await import('./store.js');
    const { triggerTaskFlowsForCronJob } = await import('./engine.js');
    const flow = upsertTaskFlow({
      name: 'cron-bound',
      steps: [{ type: 'delay', ms: 1 }],
      chainOnSuccess: [],
      triggers: [{ type: 'cron', jobId: 'daily-report' }],
      status: 'active',
    });
    const runs = triggerTaskFlowsForCronJob('daily-report', { job_id: 'daily-report' });
    expect(runs).toHaveLength(1);
    expect(listTaskFlowRuns(5).some((r) => r.flowId === flow.id)).toBe(true);
  });

  it('ignores cron triggers for other job ids', async () => {
    const { upsertTaskFlow } = await import('./store.js');
    const { triggerTaskFlowsForCronJob } = await import('./engine.js');
    upsertTaskFlow({
      name: 'cron-bound',
      steps: [{ type: 'delay', ms: 1 }],
      chainOnSuccess: [],
      triggers: [{ type: 'cron', jobId: 'daily-report' }],
      status: 'active',
    });
    expect(triggerTaskFlowsForCronJob('other-job')).toHaveLength(0);
  });

  it('webhook trigger deduplicates within the same hour bucket', async () => {
    const { upsertTaskFlow, listTaskFlowRuns } = await import('./store.js');
    const { triggerTaskFlowsForEvent } = await import('./engine.js');
    upsertTaskFlow({
      name: 'webhook-idem',
      steps: [{ type: 'delay', ms: 1 }],
      chainOnSuccess: [],
      triggers: [{ type: 'webhook', event: 'test.event' }],
      status: 'active',
    });
    triggerTaskFlowsForEvent('test.event');
    triggerTaskFlowsForEvent('test.event');
    const runs = listTaskFlowRuns(10).filter((r) => r.flowName === 'webhook-idem');
    expect(runs.length).toBe(1);
  });

  it('skips steps with cached outputs on resume', async () => {
    const { upsertTaskFlow, enqueueTaskFlowRun, updateTaskFlowRun } = await import('./store.js');
    const { executeTaskFlowRun } = await import('./engine.js');
    const flow = upsertTaskFlow({
      name: 'resume-cache',
      steps: [{ type: 'delay', ms: 5 }, { type: 'delay', ms: 5 }],
      chainOnSuccess: [],
      status: 'active',
    });
    const run = enqueueTaskFlowRun(flow.id, {
      fromStep: 1,
      stepOutputs: { '0': 'cached-step-0' },
    })!;
    const finished = await executeTaskFlowRun(run.id);
    expect(finished?.status).toBe('succeeded');
    expect(finished?.stepOutputs?.['0']).toBe('cached-step-0');
  });
});
