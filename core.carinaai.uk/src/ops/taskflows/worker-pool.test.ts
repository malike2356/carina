import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('taskflow worker pool', () => {
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

  it('respects worker pool size env', async () => {
    vi.stubEnv('CARINA_TASKFLOWS_WORKER_POOL', '4');
    const { taskFlowWorkerPoolSize } = await import('./worker.js');
    expect(taskFlowWorkerPoolSize()).toBe(4);
  });

  it('enabled by default unless explicitly false', async () => {
    vi.unstubAllEnvs();
    vi.stubEnv('CARINA_HOME', tmpHome);
    delete process.env.CARINA_TASKFLOWS_ENABLED;
    const { taskFlowsEnabled } = await import('./store.js');
    expect(taskFlowsEnabled()).toBe(true);
  });
});
