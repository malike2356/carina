import { describe, expect, it, vi, beforeEach } from 'vitest';

function mockConfig(overrides: Record<string, unknown> = {}) {
  const base = {
    brave: { apiKey: '', searchUrl: 'https://api.search.brave.com/res/v1/web/search' },
    tavily: { apiKey: '', searchDepth: 'basic' as const, searchUrl: 'https://api.tavily.com/search' },
    searxng: { url: '' },
    search: { provider: 'auto' as const },
  };
  return {
    config: {
      ...base,
      ...overrides,
      brave: { ...base.brave, ...(overrides.brave as object | undefined) },
      tavily: { ...base.tavily, ...(overrides.tavily as object | undefined) },
      searxng: { ...base.searxng, ...(overrides.searxng as object | undefined) },
      search: { ...base.search, ...(overrides.search as object | undefined) },
    },
  };
}

beforeEach(async () => {
  vi.restoreAllMocks();
  vi.resetModules();
  const { config } = await import('../config/index.js');
  config.brave.apiKey = '';
  config.brave.searchUrl = 'https://api.search.brave.com/res/v1/web/search';
  config.tavily.apiKey = '';
  config.tavily.searchDepth = 'basic';
  config.tavily.searchUrl = 'https://api.tavily.com/search';
  config.searxng.url = '';
  config.search.provider = 'auto';
});

describe('web-search-provider', () => {
  it('prefers SearXNG in auto mode when SEARXNG_URL is set', async () => {
    vi.doMock('../config/index.js', () =>
      mockConfig({
        searxng: { url: 'http://localhost:8888' },
        tavily: { apiKey: 'tvly-key', searchDepth: 'basic' },
        brave: { apiKey: 'brave-key' },
      }),
    );
    const { resolveSearchProvider } = await import('./web-search-provider.js');
    expect(await resolveSearchProvider()).toBe('searxng');
  });

  it('prefers Tavily in auto mode when both keys exist and no SearXNG', async () => {
    vi.doMock('../config/index.js', () =>
      mockConfig({
        brave: { apiKey: 'brave-key' },
        tavily: { apiKey: 'tvly-key', searchDepth: 'basic' },
      }),
    );
    const { resolveSearchProvider } = await import('./web-search-provider.js');
    expect(await resolveSearchProvider()).toBe('tavily');
  });

  it('uses Brave in auto mode when only Brave key exists', async () => {
    vi.doMock('../config/index.js', () =>
      mockConfig({
        brave: { apiKey: 'brave-key' },
        tavily: { apiKey: '', searchDepth: 'basic' },
      }),
    );
    const { resolveSearchProvider } = await import('./web-search-provider.js');
    expect(await resolveSearchProvider()).toBe('brave');
  });

  it('throws when no search keys are configured', async () => {
    vi.doMock('../config/index.js', () => mockConfig());
    const { resolveSearchProvider } = await import('./web-search-provider.js');
    await expect(resolveSearchProvider()).rejects.toThrow(/No search provider configured/);
  });

  it('honours SEARCH_PROVIDER=brave even when Tavily key exists', async () => {
    vi.doMock('../config/index.js', () =>
      mockConfig({
        brave: { apiKey: 'brave-key' },
        tavily: { apiKey: 'tvly-key', searchDepth: 'basic' },
        search: { provider: 'brave' },
      }),
    );
    const { resolveSearchProvider } = await import('./web-search-provider.js');
    expect(await resolveSearchProvider()).toBe('brave');
  });

  it('calls Tavily API with expected payload', async () => {
    vi.doMock('../config/index.js', () =>
      mockConfig({
        tavily: { apiKey: 'tvly-test', searchDepth: 'advanced' },
        search: { provider: 'tavily' },
      }),
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ title: 'Hit', url: 'https://example.com', content: 'Snippet' }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { searchTavily } = await import('./web-search-provider.js');
    const hits = await searchTavily('UK inflation', 3);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.tavily.com/search',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          api_key: 'tvly-test',
          query: 'UK inflation',
          search_depth: 'advanced',
          max_results: 3,
          include_answer: false,
        }),
      }),
    );
    expect(hits).toEqual([
      { title: 'Hit', url: 'https://example.com', description: 'Snippet' },
    ]);
  });

  it('maps Tavily content field to description', async () => {
    vi.doMock('../config/index.js', () =>
      mockConfig({
        tavily: { apiKey: 'tvly-test', searchDepth: 'basic' },
        search: { provider: 'tavily' },
      }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [{ title: 'A', url: 'https://a.test', content: 'Body text' }],
        }),
      }),
    );

    const { searchTavily } = await import('./web-search-provider.js');
    const hits = await searchTavily('test', 5);
    expect(hits[0].description).toBe('Body text');
  });

  it('returns SearXNG results with count cap', async () => {
    vi.doMock('../config/index.js', () =>
      mockConfig({
        searxng: { url: 'http://localhost:8888' },
        search: { provider: 'searxng' },
      }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [{ title: 'Hit', url: 'https://example.com', content: 'Snippet' }],
        }),
      }),
    );

    const { searchSearxng, searchProviderLabel } = await import('./web-search-provider.js');
    expect(searchProviderLabel('searxng')).toBe('SearXNG');
    const hits = await searchSearxng('UK inflation', 3);
    expect(hits).toEqual([
      { title: 'Hit', url: 'https://example.com', content: 'Snippet' },
    ]);
    const callUrl = (vi.mocked(fetch).mock.calls[0][0] as string);
    expect(callUrl).toContain('http://localhost:8888/search');
    expect(callUrl).toContain('format=json');
  });

  it('uses the workspace\'s own Tavily key (BYOK) over the global key', async () => {
    vi.doMock('../config/index.js', () =>
      mockConfig({
        tavily: { apiKey: 'global-key', searchDepth: 'basic' },
        search: { provider: 'tavily' },
      }),
    );
    vi.doMock('../brain/tenant-provider-keys.js', () => ({
      getTenantProvider: vi.fn(async (tenantId: string, provider: string) =>
        tenantId === 'ws-1' && provider === 'tavily'
          ? { provider: 'tavily', apiKey: 'tenant-own-key' }
          : null,
      ),
    }));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ title: 'Hit', url: 'https://example.com', content: 'Snippet' }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { runWebSearch, resolveSearchProvider } = await import('./web-search-provider.js');
    expect(await resolveSearchProvider('ws-1')).toBe('tavily');
    await runWebSearch('UK inflation', 3, 'ws-1');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.tavily.com/search',
      expect.objectContaining({
        body: expect.stringContaining('"api_key":"tenant-own-key"'),
      }),
    );
  });

  it('falls back to the global Tavily key when the workspace has no BYOK key saved', async () => {
    vi.doMock('../config/index.js', () =>
      mockConfig({
        tavily: { apiKey: 'global-key', searchDepth: 'basic' },
        search: { provider: 'tavily' },
      }),
    );
    vi.doMock('../brain/tenant-provider-keys.js', () => ({
      getTenantProvider: vi.fn(async () => null),
    }));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { runWebSearch } = await import('./web-search-provider.js');
    await runWebSearch('UK inflation', 3, 'ws-no-byok');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.tavily.com/search',
      expect.objectContaining({
        body: expect.stringContaining('"api_key":"global-key"'),
      }),
    );
  });

  it('lets a workspace with only its own Tavily BYOK key search, even with no global key configured', async () => {
    vi.doMock('../config/index.js', () => mockConfig());
    vi.doMock('../brain/tenant-provider-keys.js', () => ({
      getTenantProvider: vi.fn(async () => ({ provider: 'tavily', apiKey: 'tenant-only-key' })),
    }));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) }),
    );

    const { webSearchTool } = await import('./web-search.js');
    const { setWorkerSessionContext } = await import('../workers/worker-session-context.js');
    setWorkerSessionContext('session-byok', {
      worker: { workspaceId: 'ws-byok-only' },
    } as never);

    await expect(
      webSearchTool.execute({ query: 'test', _sessionId: 'session-byok' }),
    ).resolves.toEqual([]);
  });

  it('returns Brave results with count cap', async () => {
    vi.doMock('../config/index.js', () =>
      mockConfig({
        brave: { apiKey: 'brave-key' },
        search: { provider: 'brave' },
      }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          web: {
            results: [{ title: 'R', url: 'https://r.test', description: 'D' }],
          },
        }),
      }),
    );

    const { searchBrave } = await import('./web-search-provider.js');
    await searchBrave('x', 999);
    const callUrl = (vi.mocked(fetch).mock.calls[0][0] as URL).toString();
    expect(callUrl).toContain('count=10');
  });
});

describe('web-search tool', () => {
  it('throws when no search API key is configured', async () => {
    vi.doMock('../config/index.js', () => mockConfig());
    const { webSearchTool } = await import('./web-search.js');
    await expect(webSearchTool.execute({ query: 'test' })).rejects.toThrow(/No search provider configured/);
  });

  it('returns array of search results via Brave', async () => {
    vi.doMock('../config/index.js', () =>
      mockConfig({
        brave: { apiKey: 'test-key' },
        search: { provider: 'brave' },
      }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          web: {
            results: [
              { title: 'Result 1', url: 'https://example.com/1', description: 'Desc 1' },
              { title: 'Result 2', url: 'https://example.com/2', description: 'Desc 2' },
            ],
          },
        }),
      }),
    );
    const { webSearchTool } = await import('./web-search.js');
    const result = (await webSearchTool.execute({ query: 'UK base rate' })) as Array<{
      title: string;
      url: string;
    }>;
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].title).toBe('Result 1');
    expect(result[0].url).toBe('https://example.com/1');
  });

  it('uses Tavily when configured', async () => {
    vi.doMock('../config/index.js', () =>
      mockConfig({
        tavily: { apiKey: 'tvly-key', searchDepth: 'basic' },
        search: { provider: 'tavily' },
      }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [{ title: 'Tavily hit', url: 'https://tavily.test', content: 'Info' }],
        }),
      }),
    );
    const { webSearchTool } = await import('./web-search.js');
    const result = (await webSearchTool.execute({ query: 'news' })) as Array<{
      title: string;
      description: string;
    }>;
    expect(result[0].title).toBe('Tavily hit');
    expect(result[0].description).toBe('Info');
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('https://api.tavily.com/search');
  });

  it('rejects empty query', async () => {
    vi.doMock('../config/index.js', () =>
      mockConfig({
        tavily: { apiKey: 'tvly-key', searchDepth: 'basic' },
      }),
    );
    const { webSearchTool } = await import('./web-search.js');
    await expect(webSearchTool.execute({ query: '   ' })).rejects.toThrow(/non-empty query/i);
  });
});
