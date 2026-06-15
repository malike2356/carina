import { describe, expect, it } from 'vitest';
import { GoogleChatAdapter } from './google-chat-adapter.js';

describe('GoogleChatAdapter', () => {
  const token = 'google-chat-verify-token';
  const adapter = new GoogleChatAdapter(true, token, '');

  it('parses MESSAGE events', () => {
    const message = adapter.parseInbound({
      type: 'MESSAGE',
      space: { name: 'spaces/AAAABBBB' },
      message: {
        name: 'spaces/AAAABBBB/messages/CCCC',
        text: 'Status update',
        sender: { name: 'users/123', displayName: 'Sam' },
      },
    });

    expect(message?.channel).toBe('google-chat');
    expect(message?.text).toBe('Status update');
    expect(message?.conversationId).toBe('spaces/AAAABBBB');
    expect(message?.senderName).toBe('Sam');
  });

  it('accepts verification token in Authorization header', () => {
    expect(adapter.validateWebhook({
      headers: { authorization: `Bearer ${token}` },
      body: {},
    })).toBe(true);
  });

  it('accepts verification token in request body', () => {
    expect(adapter.validateWebhook({
      headers: {},
      body: { token },
    })).toBe(true);
  });
});
