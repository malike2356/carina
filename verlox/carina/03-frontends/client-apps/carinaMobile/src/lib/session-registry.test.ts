import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '@/api/types';
import {
  deriveSessionMeta,
  deriveSessionPreview,
  deriveSessionTitle,
  displaySessionTitle,
  sortSessionList,
} from './session-registry';

function msg(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id: `${role}-1`,
    role,
    content,
    createdAt: '2026-06-10T12:00:00.000Z',
    status: 'done',
  };
}

describe('session-registry', () => {
  it('derives title from first user message', () => {
    const messages = [msg('user', 'Draft an email about the quarterly review')];
    expect(deriveSessionTitle(messages)).toBe('Draft an email about the quarterly review');
  });

  it('truncates long titles', () => {
    const long = 'a'.repeat(80);
    expect(deriveSessionTitle([msg('user', long)]).endsWith('…')).toBe(true);
  });

  it('uses New chat when no user messages', () => {
    expect(deriveSessionTitle([])).toBe('New chat');
  });

  it('derives preview from latest non-streaming message', () => {
    const messages = [
      msg('user', 'Hello'),
      { ...msg('assistant', 'Here is a summary of your request.'), createdAt: '2026-06-10T12:01:00.000Z' },
    ];
    expect(deriveSessionPreview(messages)).toBe('Here is a summary of your request.');
  });

  it('builds session meta with message count', () => {
    const messages = [msg('user', 'Plan my week'), msg('assistant', 'Sure, here is a plan.')];
    const meta = deriveSessionMeta('session-1', messages);
    expect(meta.id).toBe('session-1');
    expect(meta.title).toBe('Plan my week');
    expect(meta.messageCount).toBe(2);
  });

  it('prefers custom title for display', () => {
    const meta = {
      id: 's1',
      title: 'Auto title',
      preview: 'x',
      updatedAt: '2026-06-10T12:00:00.000Z',
      messageCount: 1,
      customTitle: 'Quarterly plan',
    };
    expect(displaySessionTitle(meta)).toBe('Quarterly plan');
  });

  it('sorts pinned sessions first', () => {
    const sorted = sortSessionList([
      {
        id: 'a',
        title: 'A',
        preview: '',
        updatedAt: '2026-06-10T14:00:00.000Z',
        messageCount: 1,
      },
      {
        id: 'b',
        title: 'B',
        preview: '',
        updatedAt: '2026-06-10T12:00:00.000Z',
        messageCount: 1,
        pinned: true,
        pinnedAt: '2026-06-10T10:00:00.000Z',
      },
    ]);
    expect(sorted[0].id).toBe('b');
  });
});
