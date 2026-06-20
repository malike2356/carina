import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../billing/subscription-manager.js', () => ({
  SubscriptionManager: class {
    async getSubscriptionForOrg() {
      return { plan: 'free', trial_ends_at: new Date(Date.now() + 86400000) };
    }
  },
}));

vi.mock('./vault-service.js', () => ({
  orgHasByokKey: vi.fn(async () => false),
}));

vi.mock('./workbench-service.js', () => ({
  orgHasWorkbenchRun: vi.fn(async () => false),
}));

vi.mock('./product-audit.js', () => ({
  writeProductAudit: vi.fn(async () => undefined),
}));

vi.mock('../memory/db.js', () => ({
  pool: {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      const s = sql.replace(/\s+/g, ' ').trim();
      if (/FROM organizations WHERE id/.test(s)) {
        return {
          rows: [{
            plan: 'free',
            onboarding_flags: {},
            onboarding_dismissed: false,
          }],
          rowCount: 1,
        };
      }
      if (/COUNT\(\*\).*org_memberships/.test(s)) {
        return { rows: [{ count: '1' }], rowCount: 1 };
      }
      if (/COUNT\(\*\).*org_invites/.test(s) && /expires_at > NOW/.test(s)) {
        return { rows: [{ count: '0' }], rowCount: 1 };
      }
      if (/UPDATE organizations/.test(s)) {
        return { rows: [], rowCount: 1 };
      }
      if (/FROM product_audit_log/.test(s)) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    }),
  },
}));

import { orgHasByokKey } from './vault-service.js';
import { orgHasWorkbenchRun } from './workbench-service.js';
import { dismissOnboardingWizard, getOnboardingChecklist } from './onboarding-service.js';
import { writeProductAudit } from './product-audit.js';

describe('onboarding-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fresh org shows register and org complete with trial billing done', async () => {
    const checklist = await getOnboardingChecklist('org-1', 'user-1');
    expect(checklist.completedCount).toBeGreaterThanOrEqual(3);
    expect(checklist.steps.find((step) => step.id === 'register')?.done).toBe(true);
    expect(checklist.steps.find((step) => step.id === 'org')?.done).toBe(true);
    expect(checklist.steps.find((step) => step.id === 'billing')?.done).toBe(true);
    expect(checklist.percentComplete).toBeLessThan(100);
  });

  it('byok and workbench steps flip when services report activity', async () => {
    vi.mocked(orgHasByokKey).mockResolvedValueOnce(true);
    vi.mocked(orgHasWorkbenchRun).mockResolvedValueOnce(true);
    const checklist = await getOnboardingChecklist('org-1', 'user-1');
    expect(checklist.steps.find((step) => step.id === 'byok')?.done).toBe(true);
    expect(checklist.steps.find((step) => step.id === 'workbench')?.done).toBe(true);
  });

  it('dismissOnboardingWizard writes audit event', async () => {
    await dismissOnboardingWizard('org-1', 'user-1');
    expect(writeProductAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'onboarding.dismissed',
    }));
  });
});
