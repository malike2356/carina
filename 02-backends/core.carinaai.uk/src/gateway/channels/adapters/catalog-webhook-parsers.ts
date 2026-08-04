import type { ChannelMessage, ChannelName } from '../channel-adapter.interface.js';
import { parseGenericWebhook } from './rest-channel-helpers.js';

function genericParse(
  raw: unknown,
  channel: ChannelName,
  fields: {
    text?: string[];
    userId?: string[];
    conversationId?: string[];
    messageId?: string[];
    senderName?: string[];
    isDirect?: boolean;
  } = {},
): ChannelMessage | null {
  return parseGenericWebhook(raw, channel, (p) => {
    const text = pickField(p, fields.text ?? ['text', 'message', 'content', 'body']);
    const userId = pickField(p, fields.userId ?? ['user_id', 'userId', 'from', 'sender_id', 'author_id']);
    const conversationId = pickField(
      p,
      fields.conversationId ?? ['conversation_id', 'conversationId', 'channel_id', 'room_id', 'thread_id', 'to'],
    );
    if (!text || !userId || !conversationId) return null;
    return {
      text,
      userId,
      conversationId,
      messageId: pickField(p, fields.messageId ?? ['id', 'message_id', 'msg_id']),
      senderName: pickField(p, fields.senderName ?? ['sender_name', 'username', 'name', 'author']),
      isDirect: fields.isDirect ?? Boolean(p.is_direct ?? p.dm ?? p.direct),
      threadId: pickField(p, ['thread_id', 'threadId']),
    };
  });
}

function pickField(payload: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = payload[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return '';
}

export function parseZulipInbound(raw: unknown): ChannelMessage | null {
  const payload = raw as Record<string, unknown>;
  if (payload.type === 'zulip' || payload.event_type === 'message') {
    const message = (payload.message ?? payload) as Record<string, unknown>;
    return parseGenericWebhook(raw, 'zulip', () => ({
      text: String(message.content ?? '').replace(/<[^>]+>/g, ' ').trim(),
      userId: String(message.sender_id ?? message.sender_email ?? ''),
      conversationId: String(message.stream_id ?? message.recipient_id ?? message.topic ?? 'direct'),
      messageId: String(message.id ?? ''),
      senderName: String(message.sender_full_name ?? message.sender_email ?? ''),
      isDirect: !message.stream_id,
    }));
  }
  return genericParse(raw, 'zulip', {
    text: ['content', 'text', 'message'],
    userId: ['sender_id', 'sender_email', 'user_id'],
    conversationId: ['stream_id', 'recipient_id', 'channel', 'conversation_id'],
  });
}

export function parseRedditInbound(raw: unknown): ChannelMessage | null {
  const payload = raw as Record<string, unknown>;
  const data = (payload.data ?? payload) as Record<string, unknown>;
  return genericParse(raw, 'reddit', {
    text: ['body', 'text', 'message'],
    userId: ['author', 'author_fullname', 'user_id', 'from'],
    conversationId: ['parent_id', 'link_id', 'conversation_id', 'channel_id'],
    messageId: ['id', 'name', 'message_id'],
    senderName: ['author', 'username'],
  }) ?? genericParse(data, 'reddit');
}

export function parseBlueskyInbound(raw: unknown): ChannelMessage | null {
  const payload = raw as Record<string, unknown>;
  const message = (payload.message ?? payload.chat ?? payload) as Record<string, unknown>;
  return genericParse(raw, 'bluesky', {
    text: ['text', 'message', 'content'],
    userId: ['did', 'sender', 'from', 'author'],
    conversationId: ['convoId', 'conversation_id', 'convo_id', 'thread_id'],
    messageId: ['id', 'message_id'],
    senderName: ['handle', 'sender_handle', 'author'],
  }) ?? genericParse(message, 'bluesky');
}

export function parseSkypeInbound(raw: unknown): ChannelMessage | null {
  const payload = raw as Record<string, unknown>;
  const activity = (payload.activity ?? payload) as Record<string, unknown>;
  const from = (activity.from ?? {}) as Record<string, unknown>;
  const conversation = (activity.conversation ?? {}) as Record<string, unknown>;
  const text = String(activity.text ?? payload.text ?? '').trim();
  const userId = String(from.id ?? payload.from_id ?? '').trim();
  const conversationId = String(conversation.id ?? payload.conversation_id ?? '').trim();
  if (!text || !userId || !conversationId) {
    return genericParse(raw, 'skype');
  }
  return {
    id: String(activity.id ?? Date.now()),
    channel: 'skype',
    externalUserId: userId,
    conversationId,
    text,
    timestamp: new Date(),
    isDirect: true,
    isMention: true,
    isCommand: text.startsWith('/'),
    senderName: String(from.name ?? ''),
    raw,
  };
}

export function parsePumbleInbound(raw: unknown): ChannelMessage | null {
  return genericParse(raw, 'pumble', {
    text: ['text', 'message', 'content'],
    userId: ['user_id', 'userId', 'sender', 'from'],
    conversationId: ['channel_id', 'channel', 'conversation_id'],
  });
}

export function parseTwistInbound(raw: unknown): ChannelMessage | null {
  const payload = raw as Record<string, unknown>;
  const event = (payload.event ?? payload) as Record<string, unknown>;
  const data = (event.data ?? payload.data ?? payload) as Record<string, unknown>;
  return genericParse(raw, 'twist', {
    text: ['content', 'text', 'message'],
    userId: ['user_id', 'creator', 'author_id'],
    conversationId: ['thread_id', 'threadId', 'conversation_id'],
  }) ?? genericParse(data, 'twist');
}

export function parseRyverInbound(raw: unknown): ChannelMessage | null {
  return genericParse(raw, 'ryver', {
    text: ['text', 'body', 'message', 'content'],
    userId: ['creator', 'user', 'user_id', 'from'],
    conversationId: ['team', 'teamId', 'postId', 'conversation_id', 'channel_id'],
  });
}

export function parseWorkplaceInbound(raw: unknown): ChannelMessage | null {
  const payload = raw as Record<string, unknown>;
  const entry = ((payload.entry as unknown[]) ?? [])[0] as Record<string, unknown> | undefined;
  const messaging = ((entry?.messaging as unknown[]) ?? payload.messaging as unknown[] ?? [])[0] as
    | Record<string, unknown>
    | undefined;
  const message = (messaging?.message ?? payload.message ?? payload) as Record<string, unknown>;
  const sender = (messaging?.sender ?? payload.sender ?? {}) as Record<string, unknown>;
  const text = String(message.text ?? payload.text ?? '').trim();
  const userId = String(sender.id ?? payload.user_id ?? '').trim();
  const conversationId = String(sender.id ?? payload.conversation_id ?? userId).trim();
  if (!text || !userId) return genericParse(raw, 'workplace');
  return {
    id: String(message.mid ?? message.id ?? Date.now()),
    channel: 'workplace',
    externalUserId: userId,
    conversationId,
    text,
    timestamp: new Date(),
    isDirect: true,
    isMention: true,
    isCommand: text.startsWith('/'),
    raw,
  };
}

export function parseNaverWorksInbound(raw: unknown): ChannelMessage | null {
  const payload = raw as Record<string, unknown>;
  const event = (payload.event ?? payload) as Record<string, unknown>;
  return genericParse(raw, 'naver-works', {
    text: ['text', 'content', 'message'],
    userId: ['userId', 'user_id', 'accountId', 'from'],
    conversationId: ['channelId', 'channel_id', 'roomId', 'conversation_id'],
  }) ?? genericParse(event, 'naver-works');
}

export function parseQqInbound(raw: unknown): ChannelMessage | null {
  const payload = raw as Record<string, unknown>;
  const d = (payload.d ?? payload) as Record<string, unknown>;
  return genericParse(raw, 'qq', {
    text: ['content', 'text', 'message'],
    userId: ['author', 'author_id', 'user_id', 'openid'],
    conversationId: ['channel_id', 'guild_id', 'group_id', 'conversation_id'],
    messageId: ['id', 'message_id'],
  }) ?? genericParse(d, 'qq');
}

export function parseWeiboInbound(raw: unknown): ChannelMessage | null {
  return genericParse(raw, 'weibo', {
    text: ['text', 'content', 'message'],
    userId: ['sender_id', 'uid', 'user_id', 'from_user'],
    conversationId: ['conversation_id', 'thread_id', 'recipient_id'],
  });
}

export function parseOpenhabInbound(raw: unknown): ChannelMessage | null {
  return genericParse(raw, 'openhab', {
    text: ['message', 'text', 'payload', 'title'],
    userId: ['source', 'from', 'user_id'],
    conversationId: ['topic', 'item', 'conversation_id', 'channel'],
  });
}

export function parseSynologyChatInbound(raw: unknown): ChannelMessage | null {
  return genericParse(raw, 'synology-chat', {
    text: ['text', 'message', 'post'],
    userId: ['user_id', 'username', 'from'],
    conversationId: ['channel_id', 'channel', 'conversation_id'],
  });
}

export function parseGitterInbound(raw: unknown): ChannelMessage | null {
  const payload = raw as Record<string, unknown>;
  if (payload.fromUser && payload.text) {
    const fromUser = payload.fromUser as Record<string, unknown>;
    return {
      id: String(payload.id ?? Date.now()),
      channel: 'gitter',
      externalUserId: String(fromUser.id ?? fromUser.username ?? ''),
      conversationId: String(payload.roomId ?? payload.room_id ?? ''),
      text: String(payload.text ?? '').trim(),
      timestamp: new Date(String(payload.sent ?? payload.timestamp ?? Date.now())),
      isDirect: false,
      isMention: Boolean(payload.mentions),
      isCommand: String(payload.text ?? '').startsWith('/'),
      senderName: String(fromUser.displayName ?? fromUser.username ?? ''),
      raw,
    };
  }
  return genericParse(raw, 'gitter', {
    text: ['text', 'message'],
    userId: ['user_id', 'fromUserId'],
    conversationId: ['roomId', 'room_id', 'conversation_id'],
  });
}

export function parseElementInbound(raw: unknown): ChannelMessage | null {
  return genericParse(raw, 'element', {
    text: ['body', 'text', 'message', 'content'],
    userId: ['sender', 'user_id', 'userId'],
    conversationId: ['room_id', 'roomId', 'conversation_id'],
  });
}

export function parseMastodonInbound(raw: unknown): ChannelMessage | null {
  const payload = raw as Record<string, unknown>;
  const account = (payload.account ?? {}) as Record<string, unknown>;
  const text = String(payload.content ?? payload.text ?? payload.status ?? '')
    .replace(/<[^>]+>/g, ' ')
    .trim();
  const userId = String(account.id ?? payload.account_id ?? payload.user_id ?? '').trim();
  const conversationId = String(payload.conversation_id ?? payload.in_reply_to_id ?? userId).trim();
  if (!text || !userId) {
    return genericParse(raw, 'mastodon');
  }
  return {
    id: String(payload.id ?? Date.now()),
    channel: 'mastodon',
    externalUserId: userId,
    conversationId,
    text,
    timestamp: new Date(String(payload.created_at ?? Date.now())),
    isDirect: Boolean(payload.visibility === 'direct'),
    isMention: true,
    isCommand: text.startsWith('/'),
    senderName: String(account.username ?? account.acct ?? ''),
    raw,
  };
}

export function parseSnapchatInbound(raw: unknown): ChannelMessage | null {
  return genericParse(raw, 'snapchat', {
    text: ['text', 'message', 'body'],
    userId: ['user_id', 'sender_id', 'from'],
    conversationId: ['conversation_id', 'thread_id', 'recipient_id'],
  });
}

export function parseBridgeGenericInbound(raw: unknown): ChannelMessage | null {
  return genericParse(raw, 'bridge-generic', {
    text: ['text', 'message', 'content'],
    userId: ['user_id', 'userId', 'from', 'sender'],
    conversationId: ['conversation_id', 'conversationId', 'channel', 'room'],
  });
}

export function parseAppleBusinessChatInbound(raw: unknown): ChannelMessage | null {
  const payload = raw as Record<string, unknown>;
  const body = (payload.body ?? payload.message ?? payload) as Record<string, unknown>;
  return genericParse(raw, 'apple-business-chat', {
    text: ['body', 'text', 'message'],
    userId: ['sourceId', 'customer_id', 'user_id', 'from'],
    conversationId: ['conversationId', 'conversation_id', 'id'],
  }) ?? genericParse(body, 'apple-business-chat');
}
