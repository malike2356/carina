import { config } from '../../../config/index.js';
import { getRouter } from '../../router.js';
import { splitByLength } from '../channel-formatter.js';
import type {
  ChannelMessage,
  IChannelAdapter,
  SendOptions,
} from '../channel-adapter.interface.js';

const YOUTUBE_LIVE_CHAT_MESSAGES_URL = 'https://www.googleapis.com/youtube/v3/liveChat/messages';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const MAX_MESSAGE_LENGTH = 200;
const DEFAULT_POLL_INTERVAL_MS = 5000;

type TimerFn = typeof setTimeout;
type ClearTimerFn = typeof clearTimeout;

export function parseYoutubeInbound(raw: unknown, botChannelId = ''): ChannelMessage | null {
  const item = raw as Record<string, unknown>;
  const authorDetails = item.authorDetails as Record<string, unknown> | undefined;
  const snippet = item.snippet as Record<string, unknown> | undefined;
  if (!authorDetails || !snippet || snippet.type !== 'textMessageEvent') return null;

  const authorChannelId = String(authorDetails.channelId ?? '');
  if (botChannelId && authorChannelId === botChannelId) return null;

  const textDetails = snippet.textMessageDetails as Record<string, unknown> | undefined;
  const text = String(textDetails?.messageText ?? '').trim();
  if (!text) return null;

  return {
    id: String(item.id ?? Date.now()),
    channel: 'youtube',
    externalUserId: authorChannelId,
    conversationId: String(snippet.liveChatId ?? ''),
    text,
    timestamp: new Date(String(snippet.publishedAt ?? Date.now())),
    isDirect: false,
    isMention: /@carina\b/i.test(text),
    isCommand: text.startsWith('!'),
    senderName: String(authorDetails.displayName ?? '') || undefined,
    raw,
  };
}

export class YoutubeAdapter implements IChannelAdapter {
  readonly name = 'youtube' as const;

  private cachedAccessToken: { value: string; expiresAt: number } | null = null;

  constructor(
    readonly enabled: boolean,
    private readonly apiKey = config.youtube.apiKey,
    private readonly botChannelId = config.youtube.botChannelId,
    private readonly oauthClientId = config.youtube.oauthClientId,
    private readonly oauthClientSecret = config.youtube.oauthClientSecret,
    private readonly oauthRefreshToken = config.youtube.oauthRefreshToken,
    private readonly liveChatId = config.youtube.liveChatId,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly setTimer: TimerFn = setTimeout,
    private readonly clearTimer: ClearTimerFn = clearTimeout,
  ) {}

  parseInbound(raw: unknown): ChannelMessage | null {
    return parseYoutubeInbound(raw, this.botChannelId);
  }

  async sendMessage(conversationId: string, text: string, _options?: SendOptions): Promise<void> {
    const accessToken = await this.getOAuthAccessToken();
    if (!accessToken) return;

    const url = `${YOUTUBE_LIVE_CHAT_MESSAGES_URL}?part=snippet`;
    for (const chunk of this.formatForChannel(text)) {
      await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          snippet: {
            liveChatId: conversationId,
            type: 'textMessageEvent',
            textMessageDetails: { messageText: chunk },
          },
        }),
        signal: AbortSignal.timeout(15_000),
      });
    }
  }

  formatForChannel(text: string): string[] {
    return splitByLength(text, MAX_MESSAGE_LENGTH);
  }

  async start(): Promise<{ stop: () => void } | void> {
    if (!this.enabled || !this.checkConfigured()) return;

    let stopped = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let nextPageToken = '';
    let pollingIntervalMs = DEFAULT_POLL_INTERVAL_MS;

    const poll = async (): Promise<void> => {
      if (stopped) return;

      try {
        const url = new URL(YOUTUBE_LIVE_CHAT_MESSAGES_URL);
        url.searchParams.set('liveChatId', this.liveChatId);
        url.searchParams.set('part', 'snippet,authorDetails');
        url.searchParams.set('key', this.apiKey);
        if (nextPageToken) {
          url.searchParams.set('pageToken', nextPageToken);
        }

        const res = await this.fetchImpl(url.toString(), {
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) {
          pollTimer = this.setTimer(() => { void poll(); }, pollingIntervalMs);
          return;
        }

        const data = await res.json() as {
          items?: unknown[];
          nextPageToken?: string;
          pollingIntervalMillis?: number;
        };

        if (data.nextPageToken) {
          nextPageToken = data.nextPageToken;
        }
        if (data.pollingIntervalMillis) {
          pollingIntervalMs = data.pollingIntervalMillis;
        }

        const gateway = getRouter();
        for (const item of data.items ?? []) {
          const inbound = this.parseInbound(item);
          if (!inbound) continue;

          const chunks: string[] = [];
          for await (const chunk of gateway.handleInbound('youtube', item)) {
            chunks.push(chunk);
          }

          const reply = chunks.join('');
          if (reply) {
            await this.sendMessage(inbound.conversationId, reply, { threadId: inbound.threadId });
          }
        }
      } catch {
        // keep polling on transient errors
      }

      if (!stopped) {
        pollTimer = this.setTimer(() => { void poll(); }, pollingIntervalMs);
      }
    };

    void poll();

    return {
      stop: () => {
        stopped = true;
        if (pollTimer) {
          this.clearTimer(pollTimer);
          pollTimer = null;
        }
      },
    };
  }

  checkConfigured(): boolean {
    return Boolean(this.apiKey?.trim() && this.liveChatId?.trim());
  }

  private async getOAuthAccessToken(): Promise<string | null> {
    if (this.cachedAccessToken && this.cachedAccessToken.expiresAt > Date.now() + 60_000) {
      return this.cachedAccessToken.value;
    }
    if (!this.oauthClientId || !this.oauthClientSecret || !this.oauthRefreshToken) {
      return null;
    }

    const res = await this.fetchImpl(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.oauthClientId,
        client_secret: this.oauthClientSecret,
        refresh_token: this.oauthRefreshToken,
        grant_type: 'refresh_token',
      }).toString(),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;

    const data = await res.json() as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;

    this.cachedAccessToken = {
      value: data.access_token,
      expiresAt: Date.now() + (Number(data.expires_in ?? 3600) * 1000),
    };
    return data.access_token;
  }
}
