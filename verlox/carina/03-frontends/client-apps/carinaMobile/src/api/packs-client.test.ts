import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fetchActivePacks, fetchPackDetail, installPack, listAvailablePacks } from './packs-client';

describe('packs-client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('lists available packs from the gateway', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ packs: [{ name: 'research', version: '1.0.0' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await listAvailablePacks('https://app.carinaai.uk', {
      credentials: 'include',
    });

    expect(result.packs).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://app.carinaai.uk/api/packs/available',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('throws a readable error when install fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Pack not found', { status: 404, statusText: 'Not Found' }),
    );

    await expect(
      installPack('https://app.carinaai.uk', 'missing-pack', { credentials: 'include' }),
    ).rejects.toThrow('Packs API 404');
  });

  it('fetches active packs', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          active: ['research'],
          installed: [],
          management: 'gui',
        }),
        { status: 200 },
      ),
    );

    const result = await fetchActivePacks('https://app.carinaai.uk', { credentials: 'include' });
    expect(result.active).toEqual(['research']);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://app.carinaai.uk/api/packs/active',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('fetches pack detail by name', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          name: 'research',
          version: '1.0.0',
          description: 'Research pack',
          author: 'Carina',
          skill_count: 2,
          download_count: 0,
        }),
        { status: 200 },
      ),
    );

    const pack = await fetchPackDetail('https://app.carinaai.uk', 'research', {
      credentials: 'include',
    });
    expect(pack.name).toBe('research');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://app.carinaai.uk/api/packs/research',
      expect.objectContaining({ credentials: 'include' }),
    );
  });
});
