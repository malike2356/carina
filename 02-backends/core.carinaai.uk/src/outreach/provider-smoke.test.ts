import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('provider-backed outreach smoke + test mode', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'provider-smoke-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.stubEnv('CARINA_OUTREACH_PERSISTENCE', 'json');
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('CARINA_OUTREACH_TEST_MODE', 'true');
    vi.stubEnv('CARINA_OUTREACH_SMOKE_ALLOWLIST', 'smoke-recipient@example.test,allow@verlox.test');
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('blocks non-allowlisted recipients in test mode', async () => {
    const { assertRecipientAllowedForSend } = await import('./test-mode.js');
    expect(assertRecipientAllowedForSend({
      workspaceId: 'ws-1',
      recipient: 'prospect@scraped.example',
    })).toEqual({ ok: false, reason: 'recipient_not_allowlisted' });
    expect(assertRecipientAllowedForSend({
      workspaceId: 'ws-1',
      recipient: 'Smoke <smoke-recipient@example.test>',
    }).ok).toBe(true);
  });

  it('completes simulated 16-step provider pipeline without inventing replies', async () => {
    const { runSimulatedProviderSmoke } = await import('./provider-smoke.js');
    const { getOutreachObservabilitySnapshot } = await import('./observability/snapshot.js');
    const report = await runSimulatedProviderSmoke();
    expect(report.steps).toHaveLength(16);
    const failed = report.steps.filter((s) => !s.ok);
    expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.attribution?.sourceType).toBeTruthy();

    const snap = await getOutreachObservabilitySnapshot(report.workspaceId);
    expect(snap.testMode.testMode).toBe(true);
    expect(snap.provider.counters.sendSuccess).toBeGreaterThanOrEqual(1);
    expect(snap.provider.counters.providerEventsApplied).toBeGreaterThanOrEqual(1);
  });
});
