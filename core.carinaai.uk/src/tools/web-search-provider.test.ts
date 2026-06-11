import { describe, expect, it, vi, beforeEach } from 'vitest';

function mockConfig(overrides: Record<string, unknown> = {}) {
  return {
    config: {
      brave: { apiKey: '' },
      tavily: { apiKey: '', searchDepth: 'basic' as const },
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
    expect(ctx).toContain('TAVILY_API_KEY');
  });
});
