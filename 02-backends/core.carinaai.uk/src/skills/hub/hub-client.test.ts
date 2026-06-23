import { describe, expect, it, vi, afterEach } from 'vitest';
import { fetchHubPacks, fetchRegistrySummary, hubBaseUrl } from './hub-client.js';

describe('hub-client', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds base URL without trailing slash', () => {
    expect(hubBaseUrl('https://skills.example.com/')).toBe('https://skills.example.com');
  });

  it('fetches registry summary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ packCount: 3, skillCount: 20, categories: ['dev'], totalDownloads: 1 }),
      }),
    );

    const summary = await fetchRegistrySummary('http://localhost:3001');
    expect(summary.packCount).toBe(3);
    expect(fetch).toHaveBeenCalledWith('http://localhost:3001/api/registry');
  });

  it('throws on hub errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 503 }),
    );

    await expect(fetchHubPacks({ baseUrl: 'http://localhost:3001' })).rejects.toThrow(/503/);
  });
});
