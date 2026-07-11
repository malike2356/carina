import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fetchChatHistory } from './chat-history-client';

describe('chat-history-client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches session history with gateway auth', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          sessionId: 'sess-1',
          messages: [
            {
              id: 'm1',
              role: 'user',
              content: 'hello',
              createdAt: '2026-06-14T10:00:00.000Z',
            },
          ],
          hasMore: false,
          oldestMessageId: 'm1',
          newestMessageId: 'm1',
        }),
        { status: 200 },
      ),
    );

    const result = await fetchChatHistory('https://app.carinaai.uk', 'sess-1', {
      limit: 50,
      auth: { credentials: 'include', apiKey: 'sk-test' },
    });

    expect(result.messages).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://app.carinaai.uk/api/chat/history/sess-1?limit=50',
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({ Authorization: 'Bearer sk-test' }),
      }),
    );
  });
});
