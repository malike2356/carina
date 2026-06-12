import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runHealthCheck, applyHealthRepairs } from './health-check.js';

describe('health-check', () => {
  let tmpHome: string;

  afterEach(() => {
    if (tmpHome && fs.existsSync(tmpHome)) {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
    vi.unstubAllEnvs();
  });

  it('returns structured report with summary', async () => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-health-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.stubEnv('CARINA_SKIP_POSTGRES', 'true');
    vi.stubEnv('CARINA_LOCAL_MODE', 'true');

    const report = await runHealthCheck({ loadEnv: false });
    expect(report.generatedAt).toBeTruthy();
    expect(report.checks.length).toBeGreaterThan(3);
    expect(report.summary.ok + report.summary.warn + report.summary.fail).toBe(report.checks.length);
    expect(report.checks.every((c) => c.id && c.category && c.status)).toBe(true);
  });

  it('applyHealthRepairs creates missing CARINA_HOME', async () => {
    tmpHome = path.join(os.tmpdir(), `carina-health-repair-${Date.now()}`);
    if (fs.existsSync(tmpHome)) fs.rmSync(tmpHome, { recursive: true });
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.stubEnv('CARINA_SKIP_POSTGRES', 'true');
    vi.resetModules();
    const mod = await import('./health-check.js');
    const report = await mod.runHealthCheck({ loadEnv: false });
    const result = await mod.applyHealthRepairs(report);
    expect(fs.existsSync(tmpHome)).toBe(true);
    expect(result.applied.some((a) => a.includes('CARINA_HOME'))).toBe(true);
  });

  it('secrets-review repair writes review artifact', async () => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-health-secrets-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.stubEnv('CARINA_SKIP_POSTGRES', 'true');
    fs.writeFileSync(path.join(tmpHome, '.env'), 'ANTHROPIC_API_KEY=\n', { mode: 0o600 });
    vi.resetModules();
    const mod = await import('./health-check.js');
    const report = await mod.runHealthCheck({ loadEnv: false });
    const result = await mod.applyHealthRepairs(report);
    expect(result.applied.some((a) => a.includes('doctor-secrets-review.json'))).toBe(true);
  });
});
