import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildSecurityDashboardData,
  computeTrustScore,
  formatDashboardSummary,
  formatDashboardTui,
  publishDashboardUpdate,
} from './index.js';
import { buildSecurityTrustState } from '../trust-state.js';
import { appendSecurityAudit } from '../security-audit.js';

describe('security dashboard aggregator', () => {
  beforeEach(() => {
    process.env.CARINA_HOME = path.join(os.tmpdir(), `carina-dashboard-${Date.now()}`);
    process.env.CARINA_RASP_ENABLED = 'true';
    process.env.CARINA_GOVERNANCE_ENABLED = 'true';
    process.env.CARINA_RED_TEAM_ENABLED = 'true';
  });

  afterEach(() => {
    delete process.env.CARINA_HOME;
  });

  it('builds unified dashboard payload with required sections', async () => {
    appendSecurityAudit({
      category: 'prompt_injection',
      action: 'block',
      detail: 'Test injection blocked',
      sessionId: 'sess-dashboard-1',
    });

    const data = await buildSecurityDashboardData();
    expect(data.threatLevel).toMatch(/^(low|medium|high|critical)$/);
    expect(data.trustScore).toBeGreaterThanOrEqual(0);
    expect(data.trustScore).toBeLessThanOrEqual(100);
    expect(Array.isArray(data.realTimeEvents)).toBe(true);
    expect(data.complianceStatus.frameworks.length).toBeGreaterThan(0);
    expect(data.supplyChainHealth).toBeTruthy();
    expect(data.secretsStatus).toBeTruthy();
    expect(data.redTeamResults).toBeTruthy();
    expect(Array.isArray(data.recentIncidents)).toBe(true);
    expect(typeof data.governanceHealthy).toBe('boolean');
  });

  it('formats summary and TUI output', async () => {
    const data = await buildSecurityDashboardData();
    expect(formatDashboardSummary(data)).toContain('Security operations dashboard');
    expect(formatDashboardTui(data)).toContain('SECURITY DASHBOARD');
  });

  it('computes trust score from security trust state', async () => {
    const state = await buildSecurityTrustState();
    const score = computeTrustScore(state);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('publishes dashboard updates to stream subscribers', async () => {
    let received = 0;
    const unsubscribe = (await import('./stream.js')).subscribeDashboardStream(() => {
      received += 1;
    });
    await publishDashboardUpdate();
    unsubscribe();
    expect(received).toBeGreaterThan(0);
  });
});
