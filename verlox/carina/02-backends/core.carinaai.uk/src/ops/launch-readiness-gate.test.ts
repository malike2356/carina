import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertTrialCostControlsReady,
  evaluateLaunchReadinessGate,
  formatLaunchGateReport,
  launchGateExitCode,
} from './launch-readiness-gate.js';

vi.mock('../billing/billing-config.js', () => ({
  refreshBillingConfigCache: vi.fn(async () => undefined),
  resolveConfigValue: vi.fn(() => ''),
}));

describe('launch-readiness-gate', () => {
  beforeEach(() => {
    delete process.env.HOSTED_MODE;
    delete process.env.NODE_ENV;
    delete process.env.LAUNCH_GATE_STRICT;
    delete process.env.TENANT_KEY_ENCRYPTION_KEY;
    delete process.env.BETTER_AUTH_SECRET;
    delete process.env.AUTH_SECRET;
    delete process.env.AIVA_CHAIN_ATTEST_ENABLED;
  });

  function config(map: Record<string, string>) {
    return (key: string) => map[key] ?? '';
  }

  it('fails when billing price IDs are missing', async () => {
    const report = await evaluateLaunchReadinessGate({
      strict: false,
      skipSecrets: true,
      resolveValue: config({
        AIVA_TRIAL_DAILY_CAP_GBP: '2',
        AIVA_TRIAL_CREDIT_GBP: '5',
      }),
      readEpochAgeSeconds: async (path) => (
        path.includes('restore') ? 1000 : path.includes('backup') ? 1000 : null
      ),
    });
    const prices = report.checks.find((c) => c.id === 'billing.stripe_prices');
    expect(prices?.status).toBe('fail');
    expect(report.launchBlocked).toBe(true);
    expect(launchGateExitCode(report)).toBe(1);
  });

  it('fails when trial caps are disabled', async () => {
    const blocked = assertTrialCostControlsReady(config({
      STRIPE_PRICE_AIVA_STARTER_MONTHLY: 'price_s',
      STRIPE_PRICE_AIVA_TEAM_MONTHLY: 'price_t',
      STRIPE_PRICE_AIVA_BUSINESS_MONTHLY: 'price_b',
      AIVA_TRIAL_DAILY_CAP_GBP: 'disabled',
      AIVA_TRIAL_CREDIT_GBP: '5',
    }));
    expect(blocked.ok).toBe(false);
    expect(blocked.reasons.join(' ')).toMatch(/daily cap/i);

    const report = await evaluateLaunchReadinessGate({
      strict: false,
      skipSecrets: true,
      resolveValue: config({
        STRIPE_PRICE_AIVA_STARTER_MONTHLY: 'price_s',
        STRIPE_PRICE_AIVA_TEAM_MONTHLY: 'price_t',
        STRIPE_PRICE_AIVA_BUSINESS_MONTHLY: 'price_b',
        AIVA_TRIAL_DAILY_CAP_GBP: '0',
        AIVA_TRIAL_CREDIT_GBP: '5',
        STRIPE_PRICE_AIVA_PREPAID_5: 'p5',
        STRIPE_PRICE_AIVA_PREPAID_10: 'p10',
        STRIPE_PRICE_AIVA_PREPAID_25: 'p25',
        AIVA_P0_ESCALATION_CONTACT: 'oncall@verlox.uk',
        CARINA_SUPPORT_EMAIL: 'support@carinaai.uk',
      }),
      readEpochAgeSeconds: async () => 1000,
    });
    expect(report.checks.find((c) => c.id === 'billing.trial_daily_cap')?.status).toBe('fail');
    expect(report.launchBlocked).toBe(true);
  });

  it('fails when backups have no restore evidence', async () => {
    const report = await evaluateLaunchReadinessGate({
      strict: true,
      skipSecrets: true,
      resolveValue: config({
        STRIPE_PRICE_AIVA_STARTER_MONTHLY: 'price_s',
        STRIPE_PRICE_AIVA_TEAM_MONTHLY: 'price_t',
        STRIPE_PRICE_AIVA_BUSINESS_MONTHLY: 'price_b',
        AIVA_TRIAL_DAILY_CAP_GBP: '2',
        AIVA_TRIAL_CREDIT_GBP: '5',
        STRIPE_PRICE_AIVA_PREPAID_5: 'p5',
        STRIPE_PRICE_AIVA_PREPAID_10: 'p10',
        STRIPE_PRICE_AIVA_PREPAID_25: 'p25',
      }),
      readEpochAgeSeconds: async (path) => (
        path.includes('restore') ? null : 1000
      ),
    });
    expect(report.checks.find((c) => c.id === 'backup.restore_evidence')?.status).toBe('fail');
    expect(report.launchBlocked).toBe(true);
  });

  it('warns, not fails, for documented manual checks', async () => {
    const report = await evaluateLaunchReadinessGate({
      strict: false,
      skipSecrets: true,
      resolveValue: config({
        STRIPE_PRICE_AIVA_STARTER_MONTHLY: 'price_s',
        STRIPE_PRICE_AIVA_TEAM_MONTHLY: 'price_t',
        STRIPE_PRICE_AIVA_BUSINESS_MONTHLY: 'price_b',
        AIVA_TRIAL_DAILY_CAP_GBP: '2',
        AIVA_TRIAL_CREDIT_GBP: '5',
        STRIPE_PRICE_AIVA_PREPAID_5: 'p5',
        STRIPE_PRICE_AIVA_PREPAID_10: 'p10',
        STRIPE_PRICE_AIVA_PREPAID_25: 'p25',
        AIVA_P0_ESCALATION_CONTACT: 'oncall@verlox.uk',
        CARINA_SUPPORT_EMAIL: 'support@carinaai.uk',
      }),
      readEpochAgeSeconds: async () => 1000,
    });
    const manuals = report.checks.filter((c) => c.id.startsWith('manual.'));
    expect(manuals.length).toBeGreaterThan(0);
    expect(manuals.every((c) => c.status === 'warn' && !c.automated)).toBe(true);
    expect(report.launchBlocked).toBe(false);
    expect(launchGateExitCode(report)).toBe(0);
  });

  it('surfaces gate result clearly for release/CI', async () => {
    const report = await evaluateLaunchReadinessGate({
      strict: true,
      skipSecrets: true,
      resolveValue: config({}),
      readEpochAgeSeconds: async () => null,
    });
    const text = formatLaunchGateReport(report);
    expect(text).toContain('Launch gate:');
    expect(text).toContain('blocked=true');
    expect(text).toMatch(/\[FAIL\]/);
    expect(report.summary).toMatch(/Launch blocked/i);
  });
});
