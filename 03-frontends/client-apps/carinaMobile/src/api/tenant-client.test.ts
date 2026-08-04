import { describe, expect, it, vi, beforeEach } from 'vitest';
import { addTenantProvider, listTenantProviders } from './tenant-client';

describe('tenant-client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('lists tenant provider keys', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          providers: [{ provider: 'anthropic', enabled: true, hasKey: true }],
        }),
        { status: 200 },
      ),
    );

    const result = await listTenantProviders('https://app.carinaai.uk', {
      credentials: 'include',
    });

    expect(result.providers[0]?.provider).toBe('anthropic');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://app.carinaai.uk/api/tenant/providers',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('adds a tenant provider key', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );

    await addTenantProvider('https://app.carinaai.uk', 'anthropic', 'sk-test', {
      auth: { credentials: 'include' },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://app.carinaai.uk/api/tenant/providers',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ provider: 'anthropic', apiKey: 'sk-test' }),
      }),
    );
  });
});
