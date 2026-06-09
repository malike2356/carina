import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('scout-provisioning', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    process.env.LABYRINTH_URL = 'http://localhost:4444';
    process.env.SCOUT_PROVISION_SECRET = 'provision-secret';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts tenant details to Scout internal provision endpoint', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ accountId: 'acc-1', created: true }),
    });
    const { provisionScoutTenant } = await import('../scout-provisioning.js');
    const result = await provisionScoutTenant({
      email: 'user@example.com',
      tenantId: '11111111-1111-1111-1111-111111111111',
      licenseKey: 'scout_live_abcdef0123456789abcdef012345678',
    });
    expect(result).toEqual({ accountId: 'acc-1', created: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4444/api/internal/provision-tenant',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Scout-Provision-Secret': 'provision-secret',
        }),
      }),
    );
  });

  it('returns null when Scout URL is missing', async () => {
    delete process.env.LABYRINTH_URL;
    vi.resetModules();
    const { provisionScoutTenant } = await import('../scout-provisioning.js');
    await expect(
      provisionScoutTenant({
        email: 'user@example.com',
        tenantId: '11111111-1111-1111-1111-111111111111',
        licenseKey: 'scout_live_abcdef0123456789abcdef012345678',
      }),
    ).resolves.toBeNull();
  });
});
