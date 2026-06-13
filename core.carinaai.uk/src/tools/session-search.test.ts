import { describe, expect, it, vi, beforeEach } from 'vitest';
import { sessionSearchTool } from './session-search.js';
import {
  browseRecentSessions,
  getSessionWindow,
  searchSessions,
} from '../memory/session-index.js';

vi.mock('../memory/session-index.js', () => ({
  browseRecentSessions: vi.fn(),
  getSessionWindow: vi.fn(),
  searchSessions: vi.fn(),
}));

const mockSearch = vi.mocked(searchSessions);
const mockWindow = vi.mocked(getSessionWindow);
const mockBrowse = vi.mocked(browseRecentSessions);

describe('session-search tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('query mode calls searchSessions and returns discovery results', async () => {
    const hits = [{ sessionId: 's1', title: 'Test', snippet: 'match' }];
    mockSearch.mockResolvedValue(hits as never);

    const result = await sessionSearchTool.execute({ query: 'TypeScript decorators' });

    expect(mockSearch).toHaveBeenCalledWith('TypeScript decorators', {
      limit: 5,
      roleFilter: undefined,
    });
    expect(result).toEqual({
      mode: 'discovery',
      query: 'TypeScript decorators',
      results: hits,
    });
  });

  it('scroll mode calls getSessionWindow and returns scroll results', async () => {
    const messages = [{
      id: 'msg-1',
      sessionId: 'sess-1',
      role: 'user',
      content: 'hello',
      createdAt: new Date('2026-01-01'),
    }];
    mockWindow.mockResolvedValue(messages);

    const result = await sessionSearchTool.execute({
      session_id: 'sess-1',
      around_message_id: 'msg-1',
    });

    expect(mockWindow).toHaveBeenCalledWith('sess-1', 'msg-1', 5);
    expect(result).toEqual({
      mode: 'scroll',
      sessionId: 'sess-1',
      messages: [{
        id: 'msg-1',
        role: 'user',
        content: 'hello',
        createdAt: messages[0].createdAt,
      }],
    });
  });

  it('browse mode calls browseRecentSessions when no params', async () => {
    const recent = [{ sessionId: 's2', title: 'Recent' }];
    mockBrowse.mockResolvedValue(recent as never);

    const result = await sessionSearchTool.execute({});

    expect(mockBrowse).toHaveBeenCalledWith(5);
    expect(result).toEqual({ mode: 'browse', results: recent });
  });

  it('returns error when searchSessions throws', async () => {
    mockSearch.mockRejectedValue(new Error('bad tsquery'));

    const result = await sessionSearchTool.execute({ query: '!!!' }) as { error: string };

    expect(result.error).toBe('Session search failed.');
  });
});
