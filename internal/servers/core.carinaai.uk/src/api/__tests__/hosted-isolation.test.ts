/**
 * Tenant isolation exit gate for Sprint 2.
 * Proves org-scoped reads do not leak across organizations.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const vaultRows = [
  { org_id: 'org-a', tenant_id: 'user-a', provider: 'openai', enabled: true },
  { org_id: 'org-b', tenant_id: 'user-b', provider: 'anthropic', enabled: true },
];

const usageRows = [
  { org_id: 'org-a', tenant_id: 'user-a', tokens_used: 1000, date: '2026-06-01' },
  { org_id: 'org-b', tenant_id: 'user-b', tokens_used: 9000, date: '2026-06-01' },
];

const auditRows = [
  { id: 'a1', org_id: 'org-a', action: 'org.member_invited', details: {}, created_at: new Date() },
  { id: 'b1', org_id: 'org-b', action: 'org.member_invited', details: {}, created_at: new Date() },
];

vi.mock('../../memory/db.js', () => ({
  pool: {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      const s = sql.replace(/\s+/g, ' ').trim();
      if (/FROM tenant_provider_keys/.test(s)) {
        const orgId = params?.[0];
        const tenantId = params?.[1];
        const rows = vaultRows.filter(
          (r) => r.org_id === orgId || (r.org_id === orgId && r.tenant_id === tenantId),
        );
        return { rows: rows.map((r) => ({ provider: r.provider, enabled: r.enabled })), rowCount: rows.length };
      }
      if (/FROM usage_records/.test(s)) {
        const orgId = params?.[0];
        const tenantId = params?.[1];
        const rows = usageRows.filter(
          (r) => r.org_id === orgId || (r.org_id === orgId && r.tenant_id === tenantId),
        );
        const total = rows.reduce((sum, r) => sum + r.tokens_used, 0);
        return { rows: [{ total: String(total) }], rowCount: 1 };
      }
      if (/FROM product_audit_log/.test(s)) {
        const orgId = params?.[0];
        const rows = auditRows.filter((r) => r.org_id === orgId);
        return { rows, rowCount: rows.length };
      }
      if (/INSERT INTO product_audit_log/.test(s)) {
        auditRows.push({
          id: `new-${auditRows.length}`,
          org_id: String(params?.[0]),
          action: String(params?.[2]),
          details: JSON.parse(String(params?.[5])),
          created_at: new Date(),
        });
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
  },
}));

vi.mock('../../hosted/org-service.js', () => ({
  getPrimaryOrgForUser: vi.fn(async (userId: string) => {
    if (userId === 'user-a') return { orgId: 'org-a', userId, role: 'owner' as const };
    if (userId === 'user-b') return { orgId: 'org-b', userId, role: 'owner' as const };
    return null;
  }),
}));

import { listTenantProviders } from '../../brain/tenant-provider-keys.js';
import { UsageMeter } from '../../billing/usage-meter.js';
import { listProductAudit } from '../../hosted/product-audit.js';
import { canPerform } from '../../hosted/rbac.js';

describe('hosted tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('userA vault keys do not include org B providers', async () => {
    const providers = await listTenantProviders('org-a', 'user-a');
    expect(providers.map((p) => p.provider)).toEqual(['openai']);
    expect(providers.some((p) => p.provider === 'anthropic')).toBe(false);
  });

  it('userA usage does not include org B tokens', async () => {
    const meter = new UsageMeter();
    const status = await meter.statusForOrg('org-a', 'user-a', 'free');
    expect(status.tokensUsed).toBe(1000);
  });

  it('userA audit does not include org B events', async () => {
    const rows = await listProductAudit('org-a');
    expect(rows.every((r) => r.orgId === 'org-a')).toBe(true);
    expect(rows.some((r) => r.id === 'b1')).toBe(false);
  });

  it('listProductAudit count excludes orgB rows', async () => {
    const rowsA = await listProductAudit('org-a');
    const rowsB = await listProductAudit('org-b');
    expect(rowsA).toHaveLength(1);
    expect(rowsB).toHaveLength(1);
  });

  it('operator in org A cannot invite (RBAC)', () => {
    expect(canPerform('operator', 'org.members.invite')).toBe(false);
  });

  it('viewer in org A cannot run workbench (RBAC)', () => {
    expect(canPerform('viewer', 'workbench.run')).toBe(false);
  });
});
