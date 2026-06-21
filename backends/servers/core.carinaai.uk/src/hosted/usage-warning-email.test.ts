import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../config/index.js', () => ({
  config: {
    resend: { apiKey: 're_test', from: 'hello@carinaai.uk' },
    product: {
      domain: 'carinaai.uk',
      coreUrl: 'https://core.carinaai.uk',
      appUrl: 'https://app.carinaai.uk',
      marketingUrl: 'https://carinaai.uk',
      opsUrl: 'https://ops.carinaai.uk',
    },
  },
}));

const sendMock = vi.fn(async () => ({ id: 'email-1' }));

vi.mock('resend', () => ({
  Resend: vi.fn(function ResendMock() {
    return { emails: { send: sendMock } };
  }),
}));

vi.mock('../memory/db.js', () => ({
  pool: {
    query: vi.fn(async () => ({
      rows: [{ name: 'Acme Ops', email: 'owner@example.com' }],
      rowCount: 1,
    })),
  },
}));

const checkOrgUsageQuotaMock = vi.fn();

vi.mock('../api/hosted-billing.js', () => ({
  checkOrgUsageQuota: (...args: unknown[]) => checkOrgUsageQuotaMock(...args),
}));

vi.mock('./plan-gates.js', () => ({
  getOrgPlan: vi.fn(async () => 'carina_ops_starter'),
}));

vi.mock('../billing/credit-ledger.js', () => ({
  getMonthlyBalance: vi.fn(async () => ({
    used: 400_000,
    remaining: 100_000,
    topups: 0,
    percentUsed: 80,
    netLedger: -400_000,
  })),
  getModelMixForMonth: vi.fn(async () => []),
}));

vi.mock('../billing/credit-gate.js', () => ({
  getAllowedModelClasses: vi.fn(async () => ['mini', 'balanced']),
}));

import {
  renderUsageWarningEmailText,
  sendUsageWarningEmail,
} from './usage-warning-email.js';
import {
  getUsageWarningThreshold,
  maybeNotifyUsageWarning,
  resetUsageWarningEmailState,
} from './usage-service.js';

describe('getUsageWarningThreshold', () => {
  const limit = 1_000_000;

  it('returns null below 80 percent', () => {
    expect(getUsageWarningThreshold(Math.floor(limit * 0.79), limit)).toBeNull();
  });

  it('returns 80 at 80 percent boundary', () => {
    expect(getUsageWarningThreshold(limit * 0.8, limit)).toBe(80);
  });

  it('returns 80 between 80 and 89 percent', () => {
    expect(getUsageWarningThreshold(Math.floor(limit * 0.89), limit)).toBe(80);
  });

  it('returns 90 at 90 percent boundary', () => {
    expect(getUsageWarningThreshold(limit * 0.9, limit)).toBe(90);
  });

  it('returns 95 at 95 percent boundary', () => {
    expect(getUsageWarningThreshold(limit * 0.95, limit)).toBe(95);
  });

  it('returns 95 between 95 and 99 percent', () => {
    expect(getUsageWarningThreshold(Math.floor(limit * 0.99), limit)).toBe(95);
  });

  it('returns 100 at 100 percent boundary', () => {
    expect(getUsageWarningThreshold(limit, limit)).toBe(100);
  });

  it('returns 100 when usage exceeds limit', () => {
    expect(getUsageWarningThreshold(limit + 1, limit)).toBe(100);
  });
});

describe('sendUsageWarningEmail', () => {
  beforeEach(() => {
    sendMock.mockClear();
  });

  it('sends email with subject and billing link', async () => {
    const sent = await sendUsageWarningEmail({
      orgName: 'Acme Ops',
      ownerEmail: 'owner@example.com',
      threshold: 80,
      used: 800_000,
      limit: 1_000_000,
      unit: 'credits',
    });
    expect(sent).toBe(true);
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
      to: 'owner@example.com',
      subject: 'Carina Ops: Acme Ops has reached 80% of its monthly credit allowance',
    }));
    const text = renderUsageWarningEmailText({
      orgName: 'Acme Ops',
      ownerEmail: 'owner@example.com',
      threshold: 80,
      used: 800_000,
      limit: 1_000_000,
      unit: 'credits',
    });
    expect(text).toContain('800,000 / 1,000,000 credits');
    expect(text).not.toContain('tokens');
    expect(text).toContain('https://core.carinaai.uk/ops/billing');
  });
});

describe('maybeNotifyUsageWarning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetUsageWarningEmailState();
    checkOrgUsageQuotaMock.mockResolvedValue({
      allowed: true,
      warning: true,
      used: 800_000,
      limit: 1_000_000,
    });
  });

  it('sends email when threshold is first crossed', async () => {
    await maybeNotifyUsageWarning('org-a', 'user-1');
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('does not send email again at the same threshold', async () => {
    await maybeNotifyUsageWarning('org-a', 'user-1');
    await maybeNotifyUsageWarning('org-a', 'user-1');
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('sends a higher threshold email after a lower one was already sent', async () => {
    await maybeNotifyUsageWarning('org-a', 'user-1');
    const { getMonthlyBalance } = await import('../billing/credit-ledger.js');
    vi.mocked(getMonthlyBalance).mockResolvedValueOnce({
      used: 450_000,
      remaining: 50_000,
      topups: 0,
      percentUsed: 90,
      netLedger: -450_000,
    });
    await maybeNotifyUsageWarning('org-a', 'user-1');
    expect(sendMock).toHaveBeenCalledTimes(2);
  });
});

describe('sendUsageWarningEmail without API key', () => {
  it('skips send without throwing when Resend API key is absent', async () => {
    vi.resetModules();
    vi.doMock('../config/index.js', () => ({
      config: { resend: { apiKey: '', from: 'hello@carinaai.uk' } },
    }));
    const { sendUsageWarningEmail: sendWithoutKey } = await import('./usage-warning-email.js');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sent = await sendWithoutKey({
      orgName: 'Acme Ops',
      ownerEmail: 'owner@example.com',
      threshold: 90,
      used: 900_000,
      limit: 1_000_000,
    });
    expect(sent).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith('[carina-ops] RESEND_API_KEY not set; usage warning email skipped');
    warnSpy.mockRestore();
  });
});
