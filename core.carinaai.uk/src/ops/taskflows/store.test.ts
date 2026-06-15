import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('taskflows store', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-tf-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.stubEnv('CARINA_TASKFLOWS_ENABLED', 'true');
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('registers flows and enqueues runs', async () => {
    const { upsertTaskFlow, enqueueTaskFlowRun, listTaskFlowRuns } = await import('./store.js');
    const flow = upsertTaskFlow({
      name: 'demo',
      steps: [{ type: 'delay', ms: 1 }],
      chainOnSuccess: [],
      status: 'active',
    });
    const run = enqueueTaskFlowRun(flow.id);
    expect(run?.status).toBe('queued');
    expect(listTaskFlowRuns().some((r) => r.flowId === flow.id)).toBe(true);
  });

  it('persists delivery queue separately', async () => {
    const { enqueueDelivery, listDeliveryQueue, markDelivery, purgeDeliveryQueue } = await import('./store.js');
    const item = enqueueDelivery({ channel: 'telegram', conversationId: '123', message: 'hi', source: 'test' });
    expect(listDeliveryQueue().length).toBe(1);
    markDelivery(item.id, 'delivered');
    expect(purgeDeliveryQueue()).toBe(1);
    expect(listDeliveryQueue().length).toBe(0);
  });

  it('idempotency: second enqueue with same key returns existing queued run', async () => {
    const { upsertTaskFlow, enqueueTaskFlowRun, listTaskFlowRuns } = await import('./store.js');
    const flow = upsertTaskFlow({
      name: 'idem-test',
      steps: [{ type: 'delay', ms: 1 }],
      chainOnSuccess: [],
      status: 'active',
    });
    const key = 'webhook:my-event:' + flow.id + ':2026-06-12T10';
    const run1 = enqueueTaskFlowRun(flow.id, { idempotencyKey: key });
    const run2 = enqueueTaskFlowRun(flow.id, { idempotencyKey: key });
    expect(run1).not.toBeNull();
    expect(run2?.id).toBe(run1?.id);
    expect(listTaskFlowRuns(10).filter((r) => r.flowId === flow.id)).toHaveLength(1);
  });

  it('idempotency: different keys create separate runs', async () => {
    const { upsertTaskFlow, enqueueTaskFlowRun } = await import('./store.js');
    const flow = upsertTaskFlow({
      name: 'idem-test2',
      steps: [{ type: 'delay', ms: 1 }],
      chainOnSuccess: [],
      status: 'active',
    });
    const run1 = enqueueTaskFlowRun(flow.id, { idempotencyKey: 'key-a' });
    const run2 = enqueueTaskFlowRun(flow.id, { idempotencyKey: 'key-b' });
    expect(run1?.id).not.toBe(run2?.id);
  });

  it('idempotency: allows new run after terminal status', async () => {
    const { upsertTaskFlow, enqueueTaskFlowRun, updateTaskFlowRun } = await import('./store.js');
    const flow = upsertTaskFlow({
      name: 'idem-test3',
      steps: [{ type: 'delay', ms: 1 }],
      chainOnSuccess: [],
      status: 'active',
    });
    const key = 'rerun-key';
    const run1 = enqueueTaskFlowRun(flow.id, { idempotencyKey: key });
    updateTaskFlowRun(run1!.id, { status: 'failed' });
    const run2 = enqueueTaskFlowRun(flow.id, { idempotencyKey: key });
    expect(run2?.id).not.toBe(run1?.id);
  });

  it('stores idempotency key on run', async () => {
    const { upsertTaskFlow, enqueueTaskFlowRun } = await import('./store.js');
    const flow = upsertTaskFlow({
      name: 'idem-test4',
      steps: [{ type: 'delay', ms: 1 }],
      chainOnSuccess: [],
      status: 'active',
    });
    const run = enqueueTaskFlowRun(flow.id, { idempotencyKey: 'stored-key' });
    expect(run?.idempotencyKey).toBe('stored-key');
  });

  it('retries from failed step preserving prior outputs', async () => {
    const { upsertTaskFlow, enqueueTaskFlowRun, updateTaskFlowRun, retryTaskFlowRun } = await import('./store.js');
    const flow = upsertTaskFlow({
      name: 'resume-flow',
      steps: [{ type: 'delay', ms: 1 }, { type: 'delay', ms: 1 }],
      chainOnSuccess: [],
      status: 'active',
    });
    const run = enqueueTaskFlowRun(flow.id)!;
    updateTaskFlowRun(run.id, {
      status: 'failed',
      stepIndex: 1,
      stepOutputs: { '0': 'step0 ok' },
    });
    const retry = retryTaskFlowRun(run.id);
    expect(retry?.stepIndex).toBe(1);
    expect(retry?.stepOutputs?.['0']).toBe('step0 ok');
    expect(retry?.retriedFromRunId).toBe(run.id);
  });

  it('search finds runs by output text', async () => {
    const { upsertTaskFlow, enqueueTaskFlowRun, updateTaskFlowRun, searchTaskFlowRuns } = await import('./store.js');
    const flow = upsertTaskFlow({
      name: 'searchable',
      steps: [{ type: 'delay', ms: 1 }],
      chainOnSuccess: [],
      status: 'active',
    });
    const run = enqueueTaskFlowRun(flow.id)!;
    updateTaskFlowRun(run.id, { status: 'succeeded', output: 'unique-needle-xyz' });
    const hits = searchTaskFlowRuns('needle-xyz');
    expect(hits.some((r) => r.id === run.id)).toBe(true);
  });
});
