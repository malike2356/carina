import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('control-status', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-ctrl-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.stubEnv('CARINA_NODE_HOST_ENABLED', 'true');
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('builds control status report', async () => {
    const { buildControlStatus, formatControlStatus } = await import('./control-status.js');
    const report = await buildControlStatus({ hostRunning: true });
    expect(report.gateway.nodeHostEnabled).toBe(true);
    expect(report.pairing).toBeTruthy();
    expect(formatControlStatus(report)).toContain('Control plane');
  });
});
