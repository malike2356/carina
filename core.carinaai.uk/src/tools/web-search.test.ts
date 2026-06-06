import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('web-search tool', () => {
  it('throws when BRAVE_SEARCH_API_KEY is not set', async () => {
    vi.doMock('../config/index.js', () => ({
      config: { brave: { apiKey: '' } },
    }));
    const { webSearchTool } = await import('./web-search.js');
    await expect(webSearchTool.execute({ query: 'test' })).rejects.toThrow(
      'BRAVE_SEARCH_API_KEY',
    );
  });

  it('returns array of search results', async () => {
    const mockData = {
      web: {
        results: [
          { title: 'Result 1', url: 'https://example.com/1', description: 'Desc 1' },
          { title: 'Result 2', url: 'https://example.com/2', description: 'Desc 2' },
        ],
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => mockData }),
    );
    vi.doMock('../config/index.js', () => ({
      config: { brave: { apiKey: 'test-key' } },
    }));
    const { webSearchTool } = await import('./web-search.js');
    const result = await webSearchTool.execute({ query: 'UK base rate' }) as Array<{
      title: string;
      url: string;
    }>;
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].title).toBe('Result 1');
    expect(result[0].url).toBe('https://example.com/1');
  });

  it('caps count at 10', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ web: { results: [] } }) }),
    );
    vi.doMock('../config/index.js', () => ({
      config: { brave: { apiKey: 'k' } },
    }));
    const { webSearchTool } = await import('./web-search.js');
    await webSearchTool.execute({ query: 'x', count: 999 });
    const callUrl = (vi.mocked(fetch).mock.calls[0][0] as URL).toString();
    expect(callUrl).toContain('count=10');
  });
});
