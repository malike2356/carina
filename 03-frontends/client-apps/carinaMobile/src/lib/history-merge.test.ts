import { describe, expect, it } from 'vitest';
import { mergeMessages } from './history-merge';
import type { ChatMessage } from '@/api/types';

describe('mergeMessages', () => {
  it('deduplicates by id and content prefix', () => {
    const local: ChatMessage[] = [
      {
        id: 'local-1',
        role: 'user',
        content: 'Hello from mobile',
        createdAt: '2026-06-14T09:00:00.000Z',
        status: 'done',
      },
    ];

    const merged = mergeMessages(local, [
      {
        id: 'local-1',
        role: 'user',
        content: 'Hello from mobile',
        createdAt: '2026-06-14T09:00:00.000Z',
      },
      {
        id: 'srv-2',
        role: 'assistant',
        content: 'Reply from Telegram',
        createdAt: '2026-06-14T09:00:05.000Z',
        source: 'telegram',
      },
    ]);

    expect(merged).toHaveLength(2);
    expect(merged[1]?.id).toBe('srv-2');
    expect(merged[1]?.source).toBe('telegram');
  });

  it('sorts messages chronologically', () => {
    const merged = mergeMessages([], [
      {
        id: 'b',
        role: 'assistant',
        content: 'Later',
        createdAt: '2026-06-14T10:00:05.000Z',
      },
      {
        id: 'a',
        role: 'user',
        content: 'Earlier',
        createdAt: '2026-06-14T10:00:00.000Z',
      },
    ]);

    expect(merged[0]?.id).toBe('a');
    expect(merged[1]?.id).toBe('b');
  });
});
