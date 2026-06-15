import { describe, expect, it, vi, beforeEach } from 'vitest';

function mockConfig(overrides: Record<string, unknown> = {}) {
  return {
    config: {
      brave: { apiKey: '' },
      tavily: { apiKey: '', searchDepth: 'basic' as const },
      searxng: { url: '' },
      search: { provider: 'tavily' as const },
      ...overrides,
    },
  };
}

beforeEach(async () => {
  vi.resetModules();
});

describe('buildSearchProviderContext', () => {
  it('mentions Tavily when configured', async () => {
    vi.doMock('../config/index.js', () =>
      mockConfig({ tavily: { apiKey: 'tvly-x', searchDepth: 'basic' } }),
    );
    vi.resetModules();
    const { buildSearchProviderContext } = await import('./web-search-provider.js');
    const ctx = buildSearchProviderContext();
    expect(ctx).toContain('Tavily');
    expect(ctx).toContain('web-search');
    expect(ctx).not.toMatch(/Brave Search is available/);
  });

  it('says unconfigured when no key', async () => {
    vi.doMock('../config/index.js', () => mockConfig());
    vi.resetModules();
    const { buildSearchProviderContext } = await import('./web-search-provider.js');
    const ctx = buildSearchProviderContext();
    expect(ctx).toContain('not configured');
    expect(ctx).toMatch(/SEARXNG_URL|TAVILY_API_KEY/);
  });

  it('mentions SearXNG when configured', async () => {
    vi.doMock('../config/index.js', () =>
      mockConfig({ searxng: { url: 'http://localhost:8888' }, search: { provider: 'searxng' } }),
    );
    vi.resetModules();
    const { buildSearchProviderContext } = await import('./web-search-provider.js');
    const ctx = buildSearchProviderContext();
    expect(ctx).toContain('SearXNG');
    expect(ctx).toContain('web-search');
  });
});
