import crypto from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildTwitterCrcResponse,
  formatOAuth1AuthorizationHeader,
  signOAuth1Request,
} from './twitter-oauth.js';
import { parseTwitterInbound, TwitterAdapter } from './twitter-adapter.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const SAMPLE_DM_EVENT = {
  direct_message_events: [
    {
      type: 'message_create',
      id: 'dm-event-1',
      created_timestamp: '1_700_000_000_000',
      message_create: {
        target: { recipient_id: 'BOT_USER_ID' },
        sender_id: 'USER_999',
        message_data: { text: 'Hey Carina' },
      },
    },
  ],
};

describe('TwitterAdapter', () => {
  const credentials = {
    apiKey: 'api-key',
    apiSecret: 'api-secret',
    accessToken: 'access-token',
    accessTokenSecret: 'access-token-secret',
    consumerSecret: 'consumer-secret',
    botUserId: 'BOT_USER_ID',
  };

  function adapter(): TwitterAdapter {
    return new TwitterAdapter(
      true,
      credentials.apiKey,
      credentials.apiSecret,
      credentials.accessToken,
      credentials.accessTokenSecret,
      credentials.consumerSecret,
      credentials.botUserId,
    );
  }

  afterEach(() => {
    mockFetch.mockReset();
  });

  it('CRC challenge responds with HMAC-SHA256 base64 of crc_token', () => {
    const crcToken = 'challenge_token_abc';
    const response = buildTwitterCrcResponse(crcToken, credentials.consumerSecret);
    const expected = `sha256=${crypto
      .createHmac('sha256', credentials.consumerSecret)
      .update(crcToken)
      .digest('base64')}`;

    expect(response).toEqual({ response_token: expected });
  });

  it('parseInbound extracts DM sender and text', () => {
    const message = adapter().parseInbound(SAMPLE_DM_EVENT);

    expect(message?.channel).toBe('twitter');
    expect(message?.id).toBe('dm-event-1');
    expect(message?.externalUserId).toBe('USER_999');
    expect(message?.conversationId).toBe('USER_999');
    expect(message?.text).toBe('Hey Carina');
    expect(message?.isDirect).toBe(true);
    expect(message?.isMention).toBe(false);
    expect(message?.isCommand).toBe(false);
  });

  it('parseInbound skips messages from the bot user ID', () => {
    const payload = {
      direct_message_events: [
        {
          id: 'dm-event-2',
          message_create: {
            sender_id: 'BOT_USER_ID',
            message_data: { text: 'echo loop' },
          },
        },
      ],
    };

    expect(parseTwitterInbound(payload, 'BOT_USER_ID')).toBeNull();
    expect(adapter().parseInbound(payload)).toBeNull();
  });

  it('formatForChannel splits messages longer than 10000 chars', () => {
    const chunks = adapter().formatForChannel('x'.repeat(15_000));
    expect(chunks.length).toBe(2);
    expect(chunks[0]?.length).toBe(10_000);
    expect(chunks[1]?.length).toBe(5_000);
  });

  it('sendMessage calls v2 DM endpoint with OAuth 1.0a Authorization header', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const tw = adapter();

    await tw.sendMessage('USER_999', 'Reply from Carina');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.twitter.com/2/dm_conversations/with/USER_999/messages');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ text: 'Reply from Carina' });

    const auth = String((init.headers as Record<string, string>).Authorization);
    expect(auth.startsWith('OAuth ')).toBe(true);
    expect(auth).toContain('oauth_consumer_key="api-key"');
    expect(auth).toContain('oauth_token="access-token"');
    expect(auth).toContain('oauth_signature=');
  });

  it('validateWebhook accepts signed POST payloads', () => {
    const rawBody = JSON.stringify(SAMPLE_DM_EVENT);
    const signature = `sha256=${crypto
      .createHmac('sha256', credentials.consumerSecret)
      .update(rawBody)
      .digest('base64')}`;

    expect(adapter().validateWebhook({
      headers: { 'x-twitter-webhooks-signature': signature },
      body: JSON.parse(rawBody),
      rawBody,
    })).toBe(true);
  });

  it('OAuth signing is deterministic with fixed nonce and timestamp', () => {
    const url = 'https://api.twitter.com/2/dm_conversations/with/USER_999/messages';
    const oauthParams = signOAuth1Request({
      method: 'POST',
      url,
      consumerKey: credentials.apiKey,
      consumerSecret: credentials.apiSecret,
      accessToken: credentials.accessToken,
      accessTokenSecret: credentials.accessTokenSecret,
      nonce: 'fixed-nonce',
      timestamp: '1700000000',
    });

    const header = formatOAuth1AuthorizationHeader(oauthParams);
    expect(header).toContain('oauth_nonce="fixed-nonce"');
    expect(header).toContain('oauth_timestamp="1700000000"');
    expect(oauthParams.oauth_signature).toBeTruthy();
  });
});
