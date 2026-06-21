import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('taskflows worker', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-tf-worker-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.stubEnv('CARINA_TASKFLOWS_ENABLED', 'true');
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('cancels queued runs', async () => {
    const { upsertTaskFlow, enqueueTaskFlowRun } = await import('./store.js');
    const { cancelTaskFlowRun } = await import('./worker.js');
    const flow = upsertTaskFlow({
      name: 'demo',
      steps: [{ type: 'delay', ms: 1 }],
      chainOnSuccess: [],
      status: 'active',
    });
    const run = enqueueTaskFlowRun(flow.id)!;
    const cancelled = cancelTaskFlowRun(run.id);
    expect(cancelled?.status).toBe('cancelled');
  });

  it('marks stale queued runs as lost', async () => {
    const { upsertTaskFlow, enqueueTaskFlowRun, updateTaskFlowRun } = await import('./store.js');
    const { markStaleTaskFlowRuns } = await import('./worker.js');
    const flow = upsertTaskFlow({
      name: 'stale',
      steps: [{ type: 'delay', ms: 1 }],
      chainOnSuccess: [],
      status: 'active',
    });
    const run = enqueueTaskFlowRun(flow.id)!;
    updateTaskFlowRun(run.id, { queuedAt: new Date(Date.now() - 60_000).toISOString() });
    expect(markStaleTaskFlowRuns(1000)).toBe(1);
    const { listTaskFlowRuns } = await import('./store.js');
    expect(listTaskFlowRuns(5)[0]?.status).toBe('lost');
  });

  it('summarizes run states', async () => {
    const { upsertTaskFlow, enqueueTaskFlowRun, updateTaskFlowRun } = await import('./store.js');
    const { summarizeTaskFlowRuns } = await import('./worker.js');
    const flow = upsertTaskFlow({
      name: 'counts',
      steps: [{ type: 'delay', ms: 1 }],
      chainOnSuccess: [],
      status: 'active',
    });
    const run = enqueueTaskFlowRun(flow.id)!;
    updateTaskFlowRun(run.id, { status: 'running', startedAt: new Date().toISOString() });
    const counts = summarizeTaskFlowRuns();
    expect(counts.running).toBe(1);
  });
});

describe('taskflows webhook triggers', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-tf-hook-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.stubEnv('CARINA_TASKFLOWS_ENABLED', 'true');
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('enqueues runs for matching webhook triggers', async () => {
    const { upsertTaskFlow, listTaskFlowRuns } = await import('./store.js');
    const { triggerTaskFlowsForEvent } = await import('./engine.js');
    const flow = upsertTaskFlow({
      name: 'on-cron',
      steps: [{ type: 'delay', ms: 1 }],
      chainOnSuccess: [],
      triggers: [{ type: 'webhook', event: 'cron.complete' }],
      status: 'active',
    });
    const runs = triggerTaskFlowsForEvent('cron.complete', { jobId: 'j1' });
    expect(runs).toHaveLength(1);
    expect(listTaskFlowRuns(5).some((r) => r.flowId === flow.id)).toBe(true);
  });
});
