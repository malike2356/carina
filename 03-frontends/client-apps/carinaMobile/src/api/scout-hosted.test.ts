import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fetchScoutKey } from './scout-hosted';

describe('scout-hosted', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches the Scout API key for Pro tenants', async () => {
    const payload = {
      apiKey: 'scout_live_test',
      instanceId: 'inst_1',
      envSnippet: 'LABYRINTH_ENABLED=true',
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200 }),
    );

    await expect(
      fetchScoutKey('https://app.carinaai.uk', { apiKey: 'sess-token' }),
    ).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://app.carinaai.uk/app/auth/scout/key',
      expect.objectContaining({
        credentials: 'omit',
        headers: expect.objectContaining({ Authorization: 'Bearer sess-token' }),
      }),
    );
  });
});
