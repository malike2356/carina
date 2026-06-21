import { describe, expect, it, vi, beforeEach } from 'vitest';

describe('landRegistryTool', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('is enabled for runtime registration', async () => {
    const { LAND_REGISTRY_TOOL_ENABLED } = await import('./land-registry.js');
    expect(LAND_REGISTRY_TOOL_ENABLED).toBe(true);
  });

  it('returns configuration error when no API key is set', async () => {
    vi.doMock('./land-registry-client.js', () => ({
      isLandRegistryConfigured: () => false,
      runLandRegistrySearch: vi.fn(),
    }));
    const { landRegistryTool } = await import('./land-registry.js');
    const result = await landRegistryTool.execute({
      query: 'ON176985',
      searchType: 'title',
    }) as { error?: string };
    expect(result.error).toContain('API key');
  });

  it('delegates to the client when configured', async () => {
    vi.doMock('./land-registry-client.js', () => ({
      isLandRegistryConfigured: () => true,
      runLandRegistrySearch: vi.fn().mockResolvedValue({
        status: 'success',
        searchType: 'title',
        title: 'ON176985',
      }),
    }));
    const { landRegistryTool } = await import('./land-registry.js');
    const { runLandRegistrySearch } = await import('./land-registry-client.js');
    const result = await landRegistryTool.execute({
      query: 'ON176985',
      searchType: 'title',
    }) as { status?: string };
    expect(runLandRegistrySearch).toHaveBeenCalledWith('ON176985', 'title');
    expect(result.status).toBe('success');
  });
});
