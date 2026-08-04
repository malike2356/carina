import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyScoutCredentials } from './scout-credentials';

describe('verifyScoutCredentials', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends both supported authentication headers to Scout', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(verifyScoutCredentials('https://scout.example/', 'key-1')).resolves.toEqual({
      ok: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://scout.example/api/events?limit=1',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer key-1',
          'X-Scout-Key': 'key-1',
        }),
      }),
    );
  });

  it('returns safe errors for rejected keys and network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));
    await expect(verifyScoutCredentials('https://scout.example', 'bad')).resolves.toEqual({
      ok: false,
      error: 'Scout rejected the API key',
    });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(verifyScoutCredentials('https://scout.example', 'key')).resolves.toEqual({
      ok: false,
      error: 'offline',
    });
  });
});
