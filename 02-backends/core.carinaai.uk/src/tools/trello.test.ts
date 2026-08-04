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

  it('deep-reads Trello card content across a board', async () => {
    vi.doMock('../integrations/trello-client.js', () => ({
      isTrelloConfigured: async () => true,
      trelloConfigHint: () => 'Trello is not configured',
      listTrelloBoards: async () => [],
      listTrelloLists: async () => [{ id: 'l1', name: 'Research' }],
      listTrelloCards: async () => [
        { id: 'c1', name: 'Market report', url: 'https://trello.com/c/1' },
      ],
      getTrelloCard: async () => ({
        id: 'c1',
        idBoard: 'b1',
        idList: 'l1',
        name: 'Market report',
        desc: 'Compare rental yields.',
        url: 'https://trello.com/c/1',
        labels: [{ id: 'label-1', name: 'Priority', color: 'red' }],
        members: [{ id: 'member-1', fullName: 'Laud' }],
        checklists: [{
          id: 'checklist-1',
          name: 'Analysis',
          checkItems: [{ id: 'item-1', name: 'Calculate yield', state: 'complete' }],
        }],
        attachments: [{
          id: 'attachment-1',
          name: 'Report.pdf',
          url: 'https://trello.com/attachment/1',
          mimeType: 'application/pdf',
        }],
        actions: [{
          id: 'action-1',
          type: 'commentCard',
          date: '2026-07-26T10:00:00.000Z',
          data: { text: 'Yield is 7 percent.' },
          memberCreator: { fullName: 'Laud' },
        }],
      }),
      createTrelloCard: async () => ({}),
      moveTrelloCard: async () => undefined,
      addTrelloComment: async () => undefined,
      archiveTrelloCard: async () => undefined,
    }));

    const { trelloTool } = await import('./trello.js');
    const result = await trelloTool.execute({ action: 'read-board', boardId: 'b1' });

    expect(result).toContain('Description: Compare rental yields.');
    expect(result).toContain('Checklist: Analysis');
    expect(result).toContain('[x] Calculate yield');
    expect(result).toContain('Attachment: Report.pdf');
    expect(result).toContain('Comment (2026-07-26T10:00:00.000Z, Laud): Yield is 7 percent.');
  });
});
