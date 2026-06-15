import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  computeZaloMac,
  parseZaloInbound,
  verifyZaloMac,
  ZaloAdapter,
} from './zalo-adapter.js';

const WEBHOOK_BODY = {
  app_id: 'zalo-app-id',
  data: '{"event_name":"user_send_text"}',
  event_name: 'user_send_text',
  timestamp: '1700000000000',
  sender: { id: 'ZALO_USER_1' },
  recipient: { id: 'OA_ID' },
  message: { msg_id: 'msg-001', text: 'Xin chao Carina' },
};

describe('ZaloAdapter', () => {
  const credentials = {
    appId: 'zalo-app-id',
    appSecret: 'zalo-app-secret',
    oaAccessToken: 'oa-access-token',
  };

  function adapter(fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({}) }) as Response)): ZaloAdapter {
    return new ZaloAdapter(
      true,
      credentials.appId,
      credentials.appSecret,
      credentials.oaAccessToken,
      fetchImpl,
    );
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parseInbound extracts message text and sender ID', () => {
    const message = adapter().parseInbound(WEBHOOK_BODY);

    expect(message?.channel).toBe('zalo');
    expect(message?.id).toBe('msg-001');
    expect(message?.externalUserId).toBe('ZALO_USER_1');
    expect(message?.conversationId).toBe('ZALO_USER_1');
    expect(message?.text).toBe('Xin chao Carina');
    expect(message?.isDirect).toBe(true);
    expect(message?.isMention).toBe(false);
  });

  it('parseInbound ignores non-text events', () => {
    expect(parseZaloInbound({ ...WEBHOOK_BODY, event_name: 'user_received_message' })).toBeNull();
  });

  it('validateWebhook passes with correct MAC', () => {
    const mac = computeZaloMac(credentials.appId, WEBHOOK_BODY.data, credentials.appSecret);

    expect(verifyZaloMac(credentials.appId, WEBHOOK_BODY.data, credentials.appSecret, mac)).toBe(true);
    expect(adapter().validateWebhook({
      headers: { mac },
      body: WEBHOOK_BODY,
    })).toBe(true);
  });

  it('validateWebhook fails with invalid MAC', () => {
    expect(adapter().validateWebhook({
      headers: { mac: 'invalid-mac' },
      body: WEBHOOK_BODY,
    })).toBe(false);
  });

  it('sendMessage posts to Zalo OA message endpoint with access_token header', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({}) }) as Response);
    await adapter(fetchImpl).sendMessage('ZALO_USER_1', 'Reply text');

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://openapi.zalo.me/v3.0/oa/message/cs');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      access_token: 'oa-access-token',
    });
    expect(JSON.parse(init.body as string)).toEqual({
      recipient: { user_id: 'ZALO_USER_1' },
      message: { text: 'Reply text' },
    });
  });

  it('formatForChannel splits messages longer than 2000 chars', () => {
    const chunks = adapter().formatForChannel('z'.repeat(3500));
    expect(chunks.length).toBe(2);
    expect(chunks.every((chunk) => chunk.length <= 2000)).toBe(true);
  });
});
