import type { ChannelAdapter, InboundMessage, OutboundMessage } from '../types.js';

interface TelegramUpdate {
  message?: {
    message_id: number;
    text?: string;
    date: number;
    from?: { id: number; first_name?: string; username?: string };
    chat: { id: number; type: string };
  };
}

export const telegramAdapter: ChannelAdapter = {
  channel: 'telegram',

  verify(headers) {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
    if (!secret) return process.env.NODE_ENV !== 'production';
    return headers['x-telegram-bot-api-secret-token'] === secret;
  },

  parse(payload, workerId, workspaceId): InboundMessage | null {
    const update = payload as TelegramUpdate;
    const msg = update.message;
    if (!msg?.text || !msg.from || !msg.chat) return null;
    if (msg.chat.type !== 'private') return null;

    return {
      channel: 'telegram',
      workerId,
      workspaceId,
      contactId: String(msg.chat.id),
      contactName: msg.from.first_name ?? msg.from.username,
      content: msg.text.trim(),
      rawPayload: payload,
      timestamp: new Date(msg.date * 1000),
      threadId: String(msg.message_id),
    };
  },

  async send(message: OutboundMessage, credentials: Record<string, string>): Promise<void> {
    const botToken = credentials.bot_token ?? credentials.token;
    if (!botToken) throw new Error('Telegram credentials missing bot_token');

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: message.contactId,
        text: message.content,
        ...(message.replyToThreadId ? { reply_to_message_id: Number(message.replyToThreadId) } : {}),
      }),
    });

    const result = await response.json() as { ok?: boolean; description?: string };
    if (!result.ok) throw new Error(`Telegram send failed: ${result.description ?? 'unknown'}`);
  },
};

export async function registerTelegramWebhook(botToken: string, workerId: string): Promise<void> {
  const coreUrl = (process.env.CORE_URL ?? process.env.CARINA_CORE_URL ?? 'https://core.carinaai.uk').replace(/\/$/, '');
  const webhookUrl = `${coreUrl}/api/channels/webhook/telegram/${workerId}`;
  const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ['message'],
      secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
    }),
  });
  const result = await response.json() as { ok?: boolean; description?: string };
  if (!result.ok) {
    throw new Error(`Telegram webhook registration failed: ${result.description ?? 'unknown'}`);
  }
}

export function telegramBotIdFromToken(token: string): string {
  return token.split(':')[0] ?? token;
}
