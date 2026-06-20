import { describe, expect, it } from 'vitest';
import type { ChatMessage, ChatSessionMeta } from '@/api/types';
import { formatSessionAsMarkdown, formatSessionAsPlainText } from './session-export';

const meta: ChatSessionMeta = {
  id: 'session-1',
  title: 'Plan my week',
  preview: 'Sure',
  updatedAt: '2026-06-10T12:00:00.000Z',
  messageCount: 2,
};

const messages: ChatMessage[] = [
  {
    id: 'u1',
    role: 'user',
    content: 'Plan my week',
    createdAt: '2026-06-10T12:00:00.000Z',
    status: 'done',
  },
  {
    id: 'a1',
    role: 'assistant',
    content: 'Here is a plan.',
    createdAt: '2026-06-10T12:01:00.000Z',
    status: 'done',
    toolsUsed: ['web-search'],
  },
];

describe('session-export', () => {
  it('formats markdown export', () => {
    const md = formatSessionAsMarkdown(meta, messages);
    expect(md).toContain('# Carina chat: Plan my week');
    expect(md).toContain('## You');
    expect(md).toContain('_Tools: web-search_');
  });

  it('formats plain text export', () => {
    const text = formatSessionAsPlainText(meta, messages);
    expect(text).toContain('Carina chat: Plan my week');
    expect(text).toContain('You:');
    expect(text).toContain('Carina:');
  });
});
