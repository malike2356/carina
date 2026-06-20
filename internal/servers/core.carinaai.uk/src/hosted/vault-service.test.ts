import { describe, expect, it, vi, beforeEach } from 'vitest';

const vaultRows: Array<Record<string, unknown>> = [];
const auditRows: Array<Record<string, unknown>> = [];

vi.mock('../memory/db.js', () => ({
  pool: {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      if (/UPDATE tenant_provider_keys SET org_id/.test(sql)) {
        return { rows: [], rowCount: 1 };
      }
      if (/UPDATE tenant_provider_keys SET enabled/.test(sql)) {
        const orgId = params?.[0];
        const enabled = params?.[1];
        const provider = params?.[2];
        const row = vaultRows.find((r) => r.org_id === orgId && r.provider === provider);
        if (row) row.enabled = enabled;
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }
      return { rows: [], rowCount: 0 };
    }),
  },
}));

vi.mock('./scoped-query.js', () => ({
  queryForOrg: vi.fn(async (orgId: string, sql: string, params?: unknown[]) => {
    if (/COUNT\(\*\)/.test(sql)) {
      const count = vaultRows.filter((row) => row.org_id === orgId).length;
      return { rows: [{ count: String(count) }], rowCount: 1 };
    }
    if (/FROM tenant_provider_keys/.test(sql) && /SELECT provider/.test(sql)) {
      const rows = vaultRows.filter((row) => row.org_id === orgId);
      return { rows, rowCount: rows.length };
    }
    if (/UPDATE tenant_provider_keys/.test(sql)) {
      const enabled = params?.[0];
      const provider = params?.[1];
      const row = vaultRows.find((r) => r.org_id === orgId && r.provider === provider);
      if (row) row.enabled = enabled;
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }
    return { rows: [], rowCount: 0 };
  }),
}));

vi.mock('../brain/tenant-provider-keys.js', () => ({
  getTenantProvider: vi.fn(async (tenantId: string, provider: string) => {
    const row = vaultRows.find((r) => r.tenant_id === tenantId && r.provider === provider);
    return row ? { provider, apiKey: 'sk-test' } : null;
  }),
  setTenantProviderKey: vi.fn(async (tenantId: string, provider: string) => {
    const existing = vaultRows.find((r) => r.tenant_id === tenantId && r.provider === provider);
    if (!existing) {
      vaultRows.push({
        tenant_id: tenantId,
        org_id: null,
        provider,
        enabled: true,
        custom_base_url: null,
        custom_model: null,
        updated_at: new Date(),
      });
    }
  }),
  removeTenantProviderKey: vi.fn(async (_tenantId: string, provider: string, orgId?: string) => {
    const idx = vaultRows.findIndex((r) => r.org_id === orgId && r.provider === provider);
    if (idx >= 0) vaultRows.splice(idx, 1);
  }),
}));

vi.mock('./plan-gates.js', () => ({
  getOrgPlan: vi.fn(async () => 'carina_ops_starter'),
}));

vi.mock('./product-audit.js', () => ({
  writeProductAudit: vi.fn(async (event: { action: string; orgId: string }) => {
    auditRows.push({ action: event.action, org_id: event.orgId });
  }),
}));

import {
  addVaultEntry,
  listVaultEntries,
  removeVaultEntry,
  toggleVaultEntry,
  VaultLimitError,
} from './vault-service.js';
import { writeProductAudit } from './product-audit.js';

describe('vault-service', () => {
  beforeEach(() => {
    vaultRows.length = 0;
    auditRows.length = 0;
    vi.clearAllMocks();
  });

  it('listVaultEntries returns summaries without key material', async () => {
    vaultRows.push({
      org_id: 'org-1',
      tenant_id: 'user-1',
      provider: 'openai',
      enabled: true,
      custom_base_url: 'https://api.example.com',
      custom_model: 'gpt-4o',
      updated_at: new Date('2026-01-01T00:00:00Z'),
    });
    const entries = await listVaultEntries('org-1');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      provider: 'openai',
      enabled: true,
      hasCustomBaseUrl: true,
      hasCustomModel: true,
    });
    expect(entries[0]).not.toHaveProperty('apiKey');
  });

  it('addVaultEntry writes audit and sets org_id', async () => {
    await addVaultEntry('org-1', 'user-1', { provider: 'openai', apiKey: 'sk-secret' }, 'user-1');
    expect(writeProductAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'vault.key_added', orgId: 'org-1' }),
    );
  });

  it('addVaultEntry enforces starter provider limit', async () => {
    for (let i = 0; i < 3; i += 1) {
      vaultRows.push({ org_id: 'org-1', provider: `p${i}` });
    }
    await expect(
      addVaultEntry('org-1', 'user-1', { provider: 'anthropic', apiKey: 'sk-x' }, 'user-1'),
    ).rejects.toBeInstanceOf(VaultLimitError);
  });

  it('removeVaultEntry isolates by org', async () => {
    vaultRows.push({ org_id: 'org-a', provider: 'openai', tenant_id: 'u1' });
    vaultRows.push({ org_id: 'org-b', provider: 'openai', tenant_id: 'u2' });
    await removeVaultEntry('org-a', 'u1', 'openai', 'u1');
    expect(vaultRows.some((row) => row.org_id === 'org-b')).toBe(true);
    expect(vaultRows.some((row) => row.org_id === 'org-a')).toBe(false);
  });

  it('toggleVaultEntry writes audit event', async () => {
    vaultRows.push({ org_id: 'org-1', provider: 'openai', enabled: true });
    await toggleVaultEntry('org-1', 'openai', false, 'user-1');
    expect(auditRows.some((row) => row.action === 'vault.key_toggled')).toBe(true);
  });
});
