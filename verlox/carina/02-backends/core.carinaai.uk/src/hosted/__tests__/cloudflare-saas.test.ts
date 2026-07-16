import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

vi.mock('../../billing/billing-config.js', () => ({
  resolveConfigValue: (key: string) => {
    if (key === 'CF_API_TOKEN') return 'cf_test_token';
    if (key === 'CF_FOR_SAAS_ZONE_ID') return 'zone_test_123';
    return '';
  },
}));

describe('cloudflare-saas', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registerCfCustomHostname calls POST /zones/{id}/custom_hostnames with correct body', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        success: true,
        result: {
          id: 'cf-host-1',
          hostname: 'aiva.client.com',
          status: 'pending',
          ssl: { status: 'pending' },
          ownership_verification: {
            type: 'txt',
            name: '_cf-custom-hostname.aiva.client.com',
            value: 'verify-token',
          },
        },
      }),
    });

    const { registerCfCustomHostname } = await import('../cloudflare-saas.js');
    const result = await registerCfCustomHostname('aiva.client.com');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/zones/zone_test_123/custom_hostnames',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer cf_test_token',
        }),
        body: JSON.stringify({
          hostname: 'aiva.client.com',
          ssl: { method: 'http', type: 'dv', settings: { min_tls_version: '1.2' } },
        }),
      }),
    );
    expect(result.id).toBe('cf-host-1');
    expect(result.ownershipVerification?.value).toBe('verify-token');
  });

  it('registerCfCustomHostname throws when CF returns success: false', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({ success: false, errors: [{ message: 'bad hostname' }] }),
    });

    const { registerCfCustomHostname } = await import('../cloudflare-saas.js');
    await expect(registerCfCustomHostname('bad.example')).rejects.toThrow(
      'CF custom hostname registration failed',
    );
  });

  it('deleteCfCustomHostname does not throw on 404', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });

    const { deleteCfCustomHostname } = await import('../cloudflare-saas.js');
    await expect(deleteCfCustomHostname('cf-host-missing')).resolves.toBeUndefined();
  });

  it('deleteCfCustomHostname throws on 500', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });

    const { deleteCfCustomHostname } = await import('../cloudflare-saas.js');
    await expect(deleteCfCustomHostname('cf-host-1')).rejects.toThrow(
      'CF custom hostname deletion failed: 500',
    );
  });
});
