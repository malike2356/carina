import type { Request, Response, Router } from 'express';

export type ChannelName =
  | 'cli'
  | 'web'
  | 'telegram'
  | 'whatsapp'
  | 'discord'
  | 'slack'
  | 'sms'
  | 'voice'
  | 'signal'
  | 'matrix'
  | 'mattermost'
  | 'dingtalk'
  | 'feishu'
  | 'wechat'
  | 'imessage'
  | 'email'
  | 'homeassistant'
  | 'api'
  | 'webhooks'
  | 'irc'
  | 'line'
  | 'viber'
  | 'google-chat'
  | 'teams'
  | 'ntfy'
  | 'pushover'
  | 'zulip'
  | 'rocketchat'
  | 'twitch'
  | 'youtube'
  | 'reddit'
  | 'bluesky'
  | 'messenger'
  | 'instagram'
  | 'twitter'
  | 'webex'
  | 'nextcloud-talk'
  | 'groupme'
  | 'linkedin'
  | 'skype'
  | 'gotify'
  | 'pumble'
  | 'twist'
  | 'ryver'
  | 'workplace'
  | 'threema'
  | 'wire'
  | 'kakaotalk'
  | 'zalo'
  | 'naver-works'
  | 'qq'
  | 'weibo'
  | 'openhab'
  | 'synology-chat'
  | 'keybase'
  | 'gitter'
  | 'element'
  | 'mastodon'
  | 'snapchat'
  | 'bridge-generic'
  | 'apple-business-chat'
  | 'system';

export interface Attachment {
  id?: string;
  url?: string;
  path?: string;
  contentType?: string;
  filename?: string;
  size?: number;
}

export interface ChannelMessage {
  id: string;
  channel: ChannelName;
  accountId?: string;
  externalUserId: string;
  conversationId: string;
  guildId?: string;
  teamId?: string;
  text: string;
  timestamp: Date;
  isDirect: boolean;
  isMention: boolean;
  isCommand: boolean;
  chatType?: 'private' | 'group';
  chatTitle?: string;
  senderName?: string;
  threadId?: string;
  replyTo?: string;
  attachments?: Attachment[];
  raw?: unknown;
}

export interface SendOptions {
  threadId?: string;
  replyTo?: string;
  ephemeral?: boolean;
  blocks?: unknown[];
  embeds?: unknown[];
  attachments?: Attachment[];
  /** Platform-specific markup (e.g. Telegram inline_keyboard). */
  replyMarkup?: unknown;
}

export interface WebhookValidationInput {
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
  rawBody?: string | Buffer;
  url?: string;
  method?: string;
}

export interface IChannelAdapter {
  readonly name: ChannelName;
  readonly enabled: boolean;
  parseInbound(raw: unknown): Promise<ChannelMessage | null> | ChannelMessage | null;
  sendMessage(conversationId: string, text: string, options?: SendOptions): Promise<void>;
  formatForChannel(text: string, options?: SendOptions): string[];
  validateWebhook?(input: WebhookValidationInput): boolean | Promise<boolean>;
  createRouter?(): Router;
  start?(): Promise<{ stop: () => void } | void>;
}

export type WebhookHandler = (req: Request, res: Response) => Promise<void>;
