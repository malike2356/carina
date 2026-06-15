import { beforeEach, describe, expect, it, vi } from 'vitest';

const orgs = new Map<string, Record<string, unknown>>();
const auditEvents: Array<Record<string, unknown>> = [];

vi.mock('../config/index.js', () => ({
  config: {
    hosted: {
      enabled: true,
      cloudEnabled: true,
    },
  },
}));

vi.mock('../memory/db.js', () => {
  const mockQuery = vi.fn(async (sql: string, params?: unknown[]) => {
    const s = sql.replace(/\s+/g, ' ').trim();

    if (/SELECT onboarding_flags FROM organizations/.test(s)) {
      const orgId = params?.[0] as string;
      const org = orgs.get(orgId);
      if (!org) return { rows: [], rowCount: 0 };
      return {
        rows: [{ onboarding_flags: org.onboarding_flags ?? {} }],
        rowCount: 1,
      };
    }

    if (/UPDATE organizations/.test(s) && /onboarding_flags/.test(s)) {
      const orgId = params?.[0] as string;
      const flags = JSON.parse(String(params?.[1])) as Record<string, unknown>;
      const org = orgs.get(orgId);
      if (org) org.onboarding_flags = flags;
      return { rows: [], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  });

  return { pool: { query: mockQuery } };
});

vi.mock('./product-audit.js', () => ({
  writeProductAudit: vi.fn(async (event: Record<string, unknown>) => {
    auditEvents.push(event);
  }),
}));

import {
  buildCloudOnboardingFlags,
  provisionCloudOrg,
} from './cloud-provisioner.js';

describe('cloud-provisioner', () => {
  beforeEach(() => {
    orgs.clear();
    auditEvents.length = 0;
    orgs.set('org-1', { onboarding_flags: {} });
  });

  it('buildCloudOnboardingFlags seeds empty packs and welcome checklist', () => {
    const flags = buildCloudOnboardingFlags(new Date('2026-06-14T12:00:00.000Z'));
    expect(flags.cloud_provisioned).toBe(true);
    expect(flags.active_skill_packs).toEqual([]);
    expect(flags.welcome_checklist).toEqual({
      addApiKey: false,
      choosePack: false,
      firstMessage: false,
    });
  });

  it('provisionCloudOrg writes flags and audit on first run', async () => {
    const result = await provisionCloudOrg('org-1', 'user-1');
    expect(result).toEqual({
      orgId: 'org-1',
      provisioned: true,
      alreadyProvisioned: false,
    });
    const flags = orgs.get('org-1')?.onboarding_flags as Record<string, unknown>;
    expect(flags.cloud_provisioned).toBe(true);
    expect(flags.active_skill_packs).toEqual([]);
    expect(auditEvents.some((e) => e.action === 'cloud.provisioned')).toBe(true);
  });

  it('provisionCloudOrg is idempotent on second run', async () => {
    await provisionCloudOrg('org-1', 'user-1');
    auditEvents.length = 0;
    const result = await provisionCloudOrg('org-1', 'user-1');
    expect(result).toEqual({
      orgId: 'org-1',
      provisioned: false,
      alreadyProvisioned: true,
    });
    expect(auditEvents).toHaveLength(0);
  });

  it('throws when organization is missing', async () => {
    await expect(provisionCloudOrg('missing', 'user-1')).rejects.toThrow(/not found/i);
  });
});
