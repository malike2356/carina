import { describe, expect, it, beforeEach } from 'vitest';
import {
  clearGroupResponseTracking,
  hasRecentlyResponded,
  isNoResponseNeededToken,
  recordGroupResponse,
  shouldRespondInGroup,
  wasMentioned,
} from './group-chat.js';

describe('wasMentioned', () => {
  it('detects Telegram mention entities', () => {
    expect(wasMentioned({
      message_id: 1,
      date: 1,
      chat: { id: 1, type: 'group' },
      text: '@Carina status?',
      entities: [{ type: 'mention', offset: 0, length: 7 }],
    }, 'Carina')).toBe(true);
  });

  it('detects replies to the bot', () => {
    expect(wasMentioned({
      message_id: 1,
      date: 1,
      chat: { id: 1, type: 'group' },
      text: 'what about this?',
      reply_to_message: {
        message_id: 99,
        date: 1,
        chat: { id: 1, type: 'group' },
        from: { id: 2, is_bot: true, first_name: 'Carina', username: 'carina' },
      },
    }, 'carina')).toBe(true);
  });

  it('ignores unrelated group messages', () => {
    expect(wasMentioned({
      message_id: 1,
      date: 1,
      chat: { id: 1, type: 'group' },
      text: 'lunch?',
    }, 'carina')).toBe(false);
  });
});

describe('group response rules', () => {
  beforeEach(() => clearGroupResponseTracking());

  it('skips obvious group banter', () => {
    const decision = shouldRespondInGroup({
      message: {
        source: 'telegram',
        content: "what's for lunch?",
        chatType: 'group',
        mentioned: false,
        chatId: '1',
        messageId: '2',
      },
    });

    expect(decision.respond).toBe(false);
  });

  it('skips unmentioned Discord group banter', () => {
    const decision = shouldRespondInGroup({
      message: {
        source: 'discord',
        content: 'lol nice',
        chatType: 'group',
        mentioned: false,
        chatId: 'chan-1',
        messageId: '99',
      },
    });

    expect(decision.respond).toBe(false);
    expect(decision.reason).toContain('banter');
  });

  it('responds in any group channel when mentioned', () => {
    const decision = shouldRespondInGroup({
      message: {
        source: 'slack',
        content: 'status?',
        chatType: 'group',
        mentioned: true,
        chatId: 'C123',
        messageId: '55',
      },
    });

    expect(decision.respond).toBe(true);
  });

  it('prevents repeated responses to the same trigger', () => {
    expect(hasRecentlyResponded('1', '2')).toBe(false);
    recordGroupResponse('1', '2');
    expect(hasRecentlyResponded('1', '2')).toBe(true);
  });
});

describe('isNoResponseNeededToken', () => {
  it('matches exact and mangled silence tokens', () => {
    expect(isNoResponseNeededToken('NO_RESPONSE_NEEDED')).toBe(true);
    expect(isNoResponseNeededToken('NORESPONSENEEDED')).toBe(true);
    expect(isNoResponseNeededToken(' no-response-needed ')).toBe(true);
    expect(isNoResponseNeededToken('Hello everyone')).toBe(false);
  });
});
