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
});
