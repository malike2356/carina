import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseWireInbound, WireAdapter } from './wire-adapter.js';

const MESSAGE_EVENT = {
  id: 'wire-event-1',
  type: 'conversation.message-add',
  conversation: 'conv-uuid-1',
  from: 'user-uuid-1',
  data: {
    id: 'msg-1',
    content: '@carina status update',
    recipient_mode: 'direct',
  },
};

describe('WireAdapter', () => {
  const credentials = {
    botClientId: 'wire-client-id',
    botToken: 'wire-bot-token',
    botSecret: 'wire-bot-secret',
    apiBase: 'https://prod-nginz-https.wire.com',
  };

  function adapter(fetchImpl = vi.fn(async () => ({ ok: true }) as Response)): WireAdapter {
    return new WireAdapter(
      true,
      credentials.botClientId,
      credentials.botToken,
      credentials.botSecret,
      credentials.apiBase,
      fetchImpl,
    );
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parseInbound extracts message fields for supported event types', () => {
    const message = adapter().parseInbound(MESSAGE_EVENT);

    expect(message?.channel).toBe('wire');
    expect(message?.id).toBe('wire-event-1');
    expect(message?.externalUserId).toBe('user-uuid-1');
    expect(message?.conversationId).toBe('conv-uuid-1');
    expect(message?.text).toBe('@carina status update');
    expect(message?.isDirect).toBe(true);
    expect(message?.isMention).toBe(true);
  });

  it('parseInbound filters unsupported event types', () => {
    expect(parseWireInbound({ ...MESSAGE_EVENT, type: 'conversation.member-join' })).toBeNull();
    expect(parseWireInbound({
      ...MESSAGE_EVENT,
      type: 'conversation.otr-message-add',
      data: { id: 'msg-2', text: 'encrypted hello', recipient_mode: 'direct' },
    })?.text).toBe('encrypted hello');
  });

  it('validateWebhook passes when Authorization matches bot secret', () => {
    expect(adapter().validateWebhook({
      headers: { authorization: 'Bearer wire-bot-secret' },
      body: MESSAGE_EVENT,
    })).toBe(true);
    expect(adapter().validateWebhook({
      headers: { authorization: 'wire-bot-secret' },
      body: MESSAGE_EVENT,
    })).toBe(true);
  });

  it('validateWebhook fails with wrong Authorization header', () => {
    expect(adapter().validateWebhook({
      headers: { authorization: 'Bearer wrong-secret' },
      body: MESSAGE_EVENT,
    })).toBe(false);
  });

  it('sendMessage posts to Wire bot messages endpoint', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true }) as Response);
    await adapter(fetchImpl).sendMessage('conv-uuid-1', 'Wire reply');

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://prod-nginz-https.wire.com/bot/messages');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer wire-bot-token',
      'Client-Id': 'wire-client-id',
    });
    expect(JSON.parse(init.body as string)).toEqual({
      type: 'conversation.message-add',
      conversation: 'conv-uuid-1',
      text: 'Wire reply',
    });
  });
});
