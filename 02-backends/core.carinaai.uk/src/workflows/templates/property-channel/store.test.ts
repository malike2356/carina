import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('property channel workflow store: idempotency', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-pc-store-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('runStepOnce only executes the step function a single time across repeated calls', async () => {
    const { createPropertyChannelRun, runStepOnce, getPropertyChannelRun } = await import('./store.js');
    const run = createPropertyChannelRun({
      workspaceId: 'ws-1',
      niche: 'buy-to-let-investment',
      location: 'Leeds',
      publishTime: '18:30',
    });

    let calls = 0;
    const fn = async () => {
      calls += 1;
      return { value: 'first-result' };
    };

    const first = await runStepOnce(run, 'channel-provision', fn);
    const second = await runStepOnce(first.run, 'channel-provision', fn);
    const third = await runStepOnce(second.run, 'channel-provision', fn);

    expect(calls).toBe(1);
    expect(first.skipped).toBe(false);
    expect(second.skipped).toBe(true);
    expect(third.skipped).toBe(true);
    expect(second.output).toEqual({ value: 'first-result' });
    expect(third.output).toEqual({ value: 'first-result' });

    const persisted = getPropertyChannelRun(run.id);
    expect(persisted?.steps['channel-provision'].status).toBe('succeeded');
    expect(persisted?.steps['channel-provision'].attempts).toBe(1);
  });

  it('runStepOnce marks the step failed and re-attempts on the next call after a failure', async () => {
    const { createPropertyChannelRun, runStepOnce } = await import('./store.js');
    const run = createPropertyChannelRun({
      workspaceId: 'ws-1',
      niche: 'buy-to-let-investment',
      location: 'Leeds',
      publishTime: '18:30',
    });

    let calls = 0;
    const flakyFn = async () => {
      calls += 1;
      if (calls === 1) throw new Error('transient failure');
      return { value: 'recovered' };
    };

    await expect(runStepOnce(run, 'niche-research', flakyFn)).rejects.toThrow('transient failure');
    const retried = await runStepOnce(run, 'niche-research', flakyFn);

    expect(calls).toBe(2);
    expect(retried.output).toEqual({ value: 'recovered' });
  });

  it('runRecurringStep executes on every call, unlike runStepOnce', async () => {
    const { createPropertyChannelRun, runRecurringStep } = await import('./store.js');
    const run = createPropertyChannelRun({
      workspaceId: 'ws-1',
      niche: 'buy-to-let-investment',
      location: 'Leeds',
      publishTime: '18:30',
    });

    let calls = 0;
    const fn = async () => {
      calls += 1;
      return { tick: calls };
    };

    const first = await runRecurringStep(run, 'comment-monitor', fn);
    const second = await runRecurringStep(first.run, 'comment-monitor', fn);

    expect(calls).toBe(2);
    expect(first.output).toEqual({ tick: 1 });
    expect(second.output).toEqual({ tick: 2 });
  });

  it('pause, resume, and cancel transition run status correctly', async () => {
    const {
      createPropertyChannelRun,
      pausePropertyChannelRun,
      resumePropertyChannelRun,
      cancelPropertyChannelRun,
    } = await import('./store.js');
    const run = createPropertyChannelRun({
      workspaceId: 'ws-1',
      niche: 'buy-to-let-investment',
      location: 'Leeds',
      publishTime: '18:30',
    });

    const paused = pausePropertyChannelRun(run.id);
    expect(paused?.status).toBe('paused');

    const resumed = resumePropertyChannelRun(run.id);
    expect(resumed?.status).toBe('queued');

    const cancelled = cancelPropertyChannelRun(run.id);
    expect(cancelled?.status).toBe('cancelled');
  });
});
