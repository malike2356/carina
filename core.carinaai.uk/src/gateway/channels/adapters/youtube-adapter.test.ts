import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseYoutubeInbound, YoutubeAdapter } from './youtube-adapter.js';

vi.mock('../../router.js', () => ({
  getRouter: () => ({
    handleInbound: async function* () {},
  }),
}));

const LIVE_CHAT_ITEM = {
  id: 'yt-msg-1',
  authorDetails: {
    channelId: 'author-channel-1',
    displayName: 'Viewer One',
  },
  snippet: {
    type: 'textMessageEvent',
    liveChatId: 'live-chat-abc',
    publishedAt: '2026-01-01T12:00:00Z',
    textMessageDetails: {
      messageText: '!hello @carina',
    },
  },
};

describe('YoutubeAdapter', () => {
  const credentials = {
    apiKey: 'youtube-api-key',
    botChannelId: 'bot-channel-id',
    oauthClientId: 'oauth-client-id',
    oauthClientSecret: 'oauth-client-secret',
    oauthRefreshToken: 'oauth-refresh-token',
    liveChatId: 'live-chat-abc',
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parseInbound extracts liveChatMessage fields', () => {
    const message = parseYoutubeInbound(LIVE_CHAT_ITEM, credentials.botChannelId);

    expect(message?.channel).toBe('youtube');
    expect(message?.id).toBe('yt-msg-1');
    expect(message?.externalUserId).toBe('author-channel-1');
    expect(message?.conversationId).toBe('live-chat-abc');
    expect(message?.text).toBe('!hello @carina');
    expect(message?.isDirect).toBe(false);
    expect(message?.isMention).toBe(true);
    expect(message?.isCommand).toBe(true);
    expect(message?.senderName).toBe('Viewer One');
  });

  it('parseInbound skips the bot own messages', () => {
    const ownMessage = {
      ...LIVE_CHAT_ITEM,
      authorDetails: { ...LIVE_CHAT_ITEM.authorDetails, channelId: 'bot-channel-id' },
    };
    expect(parseYoutubeInbound(ownMessage, credentials.botChannelId)).toBeNull();
  });

  it('parseInbound ignores non-text events', () => {
    expect(parseYoutubeInbound({
      ...LIVE_CHAT_ITEM,
      snippet: { ...LIVE_CHAT_ITEM.snippet, type: 'superChatEvent' },
    }, credentials.botChannelId)).toBeNull();
  });

  it('start polls live chat and schedules next poll using pollingIntervalMillis', async () => {
    let scheduledDelay = 0;
    let scheduledCallback: (() => void) | undefined;
    const setTimer = vi.fn((callback: () => void, delay?: number) => {
      scheduledDelay = delay ?? 0;
      scheduledCallback = callback;
      return 101 as unknown as ReturnType<typeof setTimeout>;
    });
    const clearTimer = vi.fn();

    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('liveChat/messages')) {
        return {
          ok: true,
          json: async () => ({
            items: [LIVE_CHAT_ITEM],
            nextPageToken: 'next-token',
            pollingIntervalMillis: 2500,
          }),
        } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    });

    const yt = new YoutubeAdapter(
      true,
      credentials.apiKey,
      credentials.botChannelId,
      credentials.oauthClientId,
      credentials.oauthClientSecret,
      credentials.oauthRefreshToken,
      credentials.liveChatId,
      fetchImpl,
      setTimer,
      clearTimer,
    );

    const handle = await yt.start();
    await new Promise((resolve) => setImmediate(resolve));

    expect(fetchImpl).toHaveBeenCalled();
    expect(fetchImpl.mock.calls[0]?.[0]).toContain('liveChatId=live-chat-abc');
    expect(setTimer).toHaveBeenCalled();
    expect(scheduledDelay).toBe(2500);
    expect(scheduledCallback).toBeTypeOf('function');

    handle?.stop();
    expect(clearTimer).toHaveBeenCalledWith(101);
  });

  it('sendMessage refreshes OAuth token and posts live chat message', async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('oauth2.googleapis.com/token')) {
        return {
          ok: true,
          json: async () => ({ access_token: 'access-token', expires_in: 3600 }),
        } as Response;
      }
      if (url.includes('liveChat/messages') && init?.method === 'POST') {
        return { ok: true, json: async () => ({}) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    });

    const yt = new YoutubeAdapter(
      true,
      credentials.apiKey,
      credentials.botChannelId,
      credentials.oauthClientId,
      credentials.oauthClientSecret,
      credentials.oauthRefreshToken,
      credentials.liveChatId,
      fetchImpl,
    );

    await yt.sendMessage('live-chat-abc', 'Stream reply');

    const postCall = fetchImpl.mock.calls.find(([url, init]) => (
      String(url).includes('liveChat/messages') && (init as RequestInit | undefined)?.method === 'POST'
    ));
    expect(postCall).toBeTruthy();
    const [, init] = postCall as [string, RequestInit];
    expect(init.headers).toMatchObject({ Authorization: 'Bearer access-token' });
    expect(JSON.parse(init.body as string)).toEqual({
      snippet: {
        liveChatId: 'live-chat-abc',
        type: 'textMessageEvent',
        textMessageDetails: { messageText: 'Stream reply' },
      },
    });
  });

  it('formatForChannel splits messages longer than 200 chars', () => {
    const yt = new YoutubeAdapter(true, credentials.apiKey, '', '', '', '', credentials.liveChatId);
    const chunks = yt.formatForChannel('y'.repeat(450));
    expect(chunks.length).toBe(3);
    expect(chunks.every((chunk) => chunk.length <= 200)).toBe(true);
  });
});
