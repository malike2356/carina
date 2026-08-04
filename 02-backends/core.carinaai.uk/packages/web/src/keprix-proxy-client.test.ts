import { afterEach, describe, expect, it, vi } from 'vitest';
import { listPlaybooks } from './keprix-proxy-client.js';

describe('keprix-proxy-client', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
    vi.restoreAllMocks();
  });

  it('lists playbooks from Keprix studio API', async () => {
    process.env.KEPRIX_API_BASE_URL = 'https://keprix.example.com';
    process.env.KEPRIX_STUDIO_BASE_URL = 'https://keprix.example.com';
    process.env.KEPRIX_SERVICE_TOKEN = 'svc-token';

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          playbooks: [
            { id: 'pb-1', name: 'Deal analysis', updated_at: '2026-07-09T10:00:00.000Z', status: 'draft' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const playbooks = await listPlaybooks();
    expect(playbooks).toEqual([
      {
        id: 'pb-1',
        name: 'Deal analysis',
        updated_at: '2026-07-09T10:00:00.000Z',
        status: 'draft',
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://keprix.example.com/api/playbooks/studio',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer svc-token',
        }),
      }),
    );
  });

  it('throws when Keprix is not configured', async () => {
    delete process.env.KEPRIX_API_BASE_URL;
    delete process.env.KEPRIX_STUDIO_BASE_URL;
    await expect(listPlaybooks()).rejects.toThrow('Keprix studio is not configured');
  });
});
