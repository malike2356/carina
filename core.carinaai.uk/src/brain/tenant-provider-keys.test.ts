import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();
const mockPool = { query: mockQuery };

beforeEach(() => {
  vi.resetModules();
  mockQuery.mockReset();
});

async function loadTenantProviderKeys() {
  vi.doMock('../hosted/scoped-query.js', () => ({
    resolveOrgIdFromUser: vi.fn(async () => 'org-test'),
    orgOrTenantWhere: () => '(org_id = $1 OR (org_id IS NULL AND tenant_id = $2))',
    queryForOrg: vi.fn(async () => ({ rows: [], rowCount: 0 })),
    rejectMissingOrgId: (orgId: string | undefined) => {
      if (!orgId) throw new Error('missing org');
    },
  }));
  vi.doMock('../memory/db.js', () => ({ pool: mockPool }));
  return import('./tenant-provider-keys.js');
}

describe('tenant provider keys', () => {
  it('encrypts and decrypts round-trip', async () => {
    const mod = await loadTenantProviderKeys();
    const encrypted = mod._encryptForTest('nvapi-test-key-123');
    expect(encrypted).toContain(':');
    expect(encrypted).not.toContain('nvapi-test-key-123');
    expect(mod._decryptForTest(encrypted)).toBe('nvapi-test-key-123');
  });

  it('stores and retrieves an encrypted key', async () => {
    const { setTenantProviderKey, getTenantProvider } = await loadTenantProviderKeys();

    mockQuery.mockResolvedValueOnce({ rows: [] });
    await setTenantProviderKey('test-tenant', 'nvidia', 'nvapi-test-key-123');

    const insertCall = mockQuery.mock.calls.find((c) =>
      String(c[0]).includes('INSERT INTO tenant_provider_keys'),
    );
    expect(insertCall).toBeDefined();
    const storedEncrypted = insertCall![1][3] as string;
    expect(storedEncrypted).not.toContain('nvapi-test-key-123');

    mockQuery.mockResolvedValueOnce({
      rows: [{
        encrypted_api_key: storedEncrypted,
        custom_base_url: null,
        custom_model: null,
        enabled: true,
      }],
    });

    const result = await getTenantProvider('test-tenant', 'nvidia');
    expect(result).not.toBeNull();
    expect(result!.apiKey).toBe('nvapi-test-key-123');
    expect(result!.provider).toBe('nvidia');
  });

  it('returns null for unknown tenant/provider', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const { getTenantProvider } = await loadTenantProviderKeys();
    const result = await getTenantProvider('nonexistent', 'nvidia');
    expect(result).toBeNull();
  });

  it('returns null when provider is disabled', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        encrypted_api_key: 'abc:def',
        custom_base_url: null,
        custom_model: null,
        enabled: false,
      }],
    });
    const { getTenantProvider } = await loadTenantProviderKeys();
    const result = await getTenantProvider('test-tenant', 'nvidia');
    expect(result).toBeNull();
  });

  it('removes a key', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const { setTenantProviderKey, removeTenantProviderKey, getTenantProvider } = await loadTenantProviderKeys();
    await setTenantProviderKey('test-tenant', 'openai', 'sk-test');
    await removeTenantProviderKey('test-tenant', 'openai');

    const deleteCall = mockQuery.mock.calls.find((c) => String(c[0]).includes('DELETE'));
    expect(deleteCall).toBeDefined();
    expect(deleteCall![1]).toEqual(['test-tenant', 'openai']);

    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await getTenantProvider('test-tenant', 'openai');
    expect(result).toBeNull();
  });

  it('lists configured providers without exposing keys', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { provider: 'nvidia', enabled: true },
        { provider: 'deepseek', enabled: false },
      ],
    });
    const { listTenantProviders } = await loadTenantProviderKeys();
    const providers = await listTenantProviders('org-test', 'test-tenant');
    expect(providers).toEqual([
      { provider: 'nvidia', enabled: true, hasKey: true },
      { provider: 'deepseek', enabled: false, hasKey: true },
    ]);
  });
});
