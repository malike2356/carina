import { describe, expect, it } from 'vitest';
import { parseConversationList, parseConversationThread } from './aiva-conversations';
import { buildResolveEscalationPayload, parseEscalationsList } from './aiva-escalations';
import { parseInboxSegment } from '@/lib/inbox-nav';

describe('aiva inbox operations', () => {
  it('parses read-only conversation summaries and threads', () => {
    const list = parseConversationList({
      conversations: [{ id: 'c1', worker: { id: 'w1', name: 'Ava' }, messageCount: 2 }],
    });
    const thread = parseConversationThread({
      conversation: { id: 'c1', workerId: 'w1' },
      messages: [{ id: 'm1', role: 'user', content: 'Hello' }],
    });

    expect(list.conversations[0]?.workerName).toBe('Ava');
    expect(thread.readOnly).toBe(true);
    expect(thread.messages[0]?.content).toBe('Hello');
  });

  it('parses escalations and requires a meaningful resolution note', () => {
    expect(parseEscalationsList({
      escalations: [{ id: 'e1', workerName: 'Ava', originalInput: 'Help' }],
    })[0]?.status).toBe('open');
    expect(buildResolveEscalationPayload('too short')).toBeNull();
    expect(buildResolveEscalationPayload('Resolved with the customer')).toEqual({
      resolutionNote: 'Resolved with the customer',
    });
  });

  it('defaults invalid inbox segments to approvals', () => {
    expect(parseInboxSegment('escalations')).toBe('escalations');
    expect(parseInboxSegment('unknown')).toBe('approvals');
  });
});
