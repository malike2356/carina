import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createMemory, fetchMemoryStats, listMemorySessions } from './memory-client';

describe('memory-client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('lists memory sessions', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          sessions: [
            {
              session_id: 'tenant:abc',
              title: 'Deploy chat',
              last_active: '2026-07-04T12:00:00.000Z',
              preview: 'kubectl rollout',
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await listMemorySessions('https://app.carinaai.uk', {
      auth: { credentials: 'include' },
    });

    expect(result.sessions).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://app.carinaai.uk/api/memory/sessions',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('fetches memory stats', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          categories: [{ category: 'general', count: '3', chars: '120' }],
        }),
        { status: 200 },
      ),
    );

    const stats = await fetchMemoryStats('https://app.carinaai.uk', { credentials: 'include' });
    expect(stats.categories[0]?.category).toBe('general');
  });

  it('creates a memory entry', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'm1',
          category: 'general',
          content: 'Remember this',
          priority: 0,
          created_at: '2026-07-04T12:00:00.000Z',
          updated_at: '2026-07-04T12:00:00.000Z',
        }),
        { status: 200 },
      ),
    );

    await createMemory('https://app.carinaai.uk', 'Remember this', {
      auth: { credentials: 'include' },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://app.carinaai.uk/api/memory',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ content: 'Remember this', category: 'general', priority: 0 }),
      }),
    );
  });
});
