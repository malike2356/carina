import crypto from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildTwitterWorkerCrcResponse,
  parseTwitterWorkerInbound,
  twitterWorkerAdapter,
} from './twitter-worker-adapter.js';

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

describe('twitter-worker-adapter', () => {
  const credentials = {
    api_key: 'api-key',
    api_secret: 'api-secret',
    access_token: 'access-token',
    access_token_secret: 'access-token-secret',
    user_id: 'BOT_USER_ID',
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TWITTER_CONSUMER_SECRET;
    delete process.env.TWITTER_API_SECRET;
  });

  it('parseTwitterWorkerInbound filters bot sender', () => {
    const message = parseTwitterWorkerInbound(
      SAMPLE_DM_EVENT,
      'worker-1',
      'workspace-1',
      credentials,
    );
    expect(message?.contactId).toBe('USER_999');
    expect(message?.content).toBe('Hey Carina');
  });

  it('parseTwitterWorkerInbound skips bot messages', () => {
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
    expect(parseTwitterWorkerInbound(payload, 'worker-1', 'workspace-1', credentials)).toBeNull();
  });

  it('buildTwitterWorkerCrcResponse uses consumer secret from env', () => {
    process.env.TWITTER_CONSUMER_SECRET = 'consumer-secret';
    const crcToken = 'challenge_token_abc';
    const response = buildTwitterWorkerCrcResponse(crcToken, credentials);
    const expected = `sha256=${crypto
      .createHmac('sha256', 'consumer-secret')
      .update(crcToken)
      .digest('base64')}`;
    expect(response).toEqual({ response_token: expected });
  });

  it('verify accepts signed POST payloads', () => {
    process.env.TWITTER_CONSUMER_SECRET = 'consumer-secret';
    const rawBody = Buffer.from(JSON.stringify(SAMPLE_DM_EVENT));
    const signature = `sha256=${crypto
      .createHmac('sha256', 'consumer-secret')
      .update(rawBody)
      .digest('base64')}`;

    expect(twitterWorkerAdapter.verify(
      { 'x-twitter-webhooks-signature': signature },
      rawBody,
      credentials,
    )).toBe(true);
  });

  it('send calls v2 DM endpoint with OAuth 1.0a header', async () => {
    process.env.TWITTER_API_KEY = 'api-key';
    process.env.TWITTER_API_SECRET = 'api-secret';
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);

    await twitterWorkerAdapter.send(
      {
        channel: 'twitter',
        contactId: 'USER_999',
        content: 'Reply from Carina',
      },
      credentials,
    );

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.twitter.com/2/dm_conversations/with/USER_999/messages');
    expect(String((init.headers as Record<string, string>).Authorization)).toContain('OAuth ');
  });
});
