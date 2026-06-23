import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('extensibility status', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-ext-status-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('reports disabled layers by default', async () => {
    vi.stubEnv('CARINA_TASKFLOWS_ENABLED', 'false');
    const { buildExtensibilityStatus, formatExtensibilityStatus } = await import('./extensibility-status.js');
    const report = await buildExtensibilityStatus();
    expect(report.taskflows.enabled).toBe(false);
    expect(report.acp.enabled).toBe(false);
    expect(report.debugProxy.running).toBe(false);
    expect(report.debugProxy.routingEnabled).toBe(false);
    expect(report.extensions.runtimeEnabled).toBe(false);
    expect(formatExtensibilityStatus(report)).toContain('taskflows: off');
  });

  it('reports enabled taskflows counts', async () => {
    vi.stubEnv('CARINA_TASKFLOWS_ENABLED', 'true');
    const { upsertTaskFlow } = await import('./taskflows/store.js');
    upsertTaskFlow({
      name: 'demo',
      steps: [{ type: 'delay', ms: 1 }],
      chainOnSuccess: [],
      status: 'active',
    });
    const { buildExtensibilityStatus } = await import('./extensibility-status.js');
    const report = await buildExtensibilityStatus();
    expect(report.taskflows.enabled).toBe(true);
    expect(report.taskflows.flows).toBe(1);
  });
});
