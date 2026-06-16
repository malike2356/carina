import { describe, expect, it, vi, beforeEach } from 'vitest';

function mockConfig(overrides: Record<string, unknown> = {}) {
  return {
    config: {
      trello: { apiKey: '', token: '', baseUrl: 'https://api.trello.com/1' },
      ...overrides,
    },
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('trelloTool', () => {
  it('returns configuration hint when credentials are missing', async () => {
    vi.doMock('../config/index.js', () => mockConfig());
    const { trelloTool } = await import('./trello.js');
    const result = await trelloTool.execute({ action: 'list-boards' });
    expect(result).toContain('Trello is not configured');
  });

  it('lists boards with formatted output', async () => {
    vi.doMock('../config/index.js', () =>
      mockConfig({ trello: { apiKey: 'key', token: 'token', baseUrl: 'https://api.trello.com/1' } }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ id: 'b1', name: 'Product', url: 'https://trello.com/b/1' }],
      }),
    );

    const { trelloTool } = await import('./trello.js');
    const result = await trelloTool.execute({ action: 'list-boards' });
    expect(result).toBe('Product (b1): https://trello.com/b/1');
    const callUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(callUrl).toContain('/members/me/boards');
    expect(callUrl).toContain('key=key');
    expect(callUrl).toContain('token=token');
  });

  it('requires confirmation for create-card', async () => {
    vi.doMock('../config/index.js', () =>
      mockConfig({ trello: { apiKey: 'key', token: 'token', baseUrl: 'https://api.trello.com/1' } }),
    );
    const { trelloTool } = await import('./trello.js');
    expect(trelloTool.needsConfirmation?.({ action: 'create-card' })).toBe(true);
    expect(trelloTool.needsConfirmation?.({ action: 'list-boards' })).toBe(false);
  });
});
