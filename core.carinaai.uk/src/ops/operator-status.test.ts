import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('operator-status', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-op-status-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.stubEnv('CARINA_SKIP_POSTGRES', 'true');
    vi.stubEnv('CARINA_LOCAL_MODE', 'true');
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('builds structured status report', async () => {
    fs.mkdirSync(path.join(tmpHome, 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(tmpHome, 'sessions', 'x.json'), '{"id":"x"}');
    fs.writeFileSync(path.join(tmpHome, '.env'), 'WEB_PORT=3000\n');
    const { buildOperatorStatus } = await import('./operator-status.js');
    const report = await buildOperatorStatus({
      homeDir: tmpHome,
      includeUpdate: false,
      skipHealth: true,
    });
    expect(report.version).toBeTruthy();
    expect(report.activeProfile).toBeTruthy();
    expect(report.sessions.localCount).toBe(1);
    expect(report.healthEndpoint.url).toContain('/api/health');
  });
});
