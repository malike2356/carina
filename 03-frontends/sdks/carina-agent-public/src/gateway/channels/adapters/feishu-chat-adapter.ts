import type { IChannelAdapter } from '../channel-adapter.interface.js';
import { parseGenericWebhook } from './rest-channel-helpers.js';
import { formatForChannel } from '../channel-formatter.js';

async function feishuToken(appId: string, appSecret: string): Promise<string | null> {
  const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const data = await res.json() as { tenant_access_token?: string };
  return data.tenant_access_token ?? null;
}

export class FeishuChatAdapter implements IChannelAdapter {
  readonly name = 'feishu' as const;

  constructor(
    readonly enabled: boolean,
    private readonly appId = process.env.FEISHU_APP_ID ?? '',
    private readonly appSecret = process.env.FEISHU_APP_SECRET ?? '',
  ) {}

  parseInbound(raw: unknown) {
    return parseGenericWebhook(raw, 'feishu', (p) => {
      const event = (p.event ?? p) as Record<string, unknown>;
      const message = (event.message ?? {}) as Record<string, unknown>;
      const content = message.content ? JSON.parse(String(message.content)) as Record<string, unknown> : {};
      const sender = event.sender as Record<string, unknown> | undefined;
      const senderId = sender?.sender_id as Record<string, unknown> | undefined;
      const operator = event.operator as Record<string, unknown> | undefined;
      return {
        text: String(content.text ?? message.text ?? ''),
        userId: String(senderId?.open_id ?? operator?.open_id ?? ''),
        conversationId: String(message.chat_id ?? event.chat_id ?? ''),
        messageId: String(message.message_id ?? ''),
        isDirect: String(message.chat_type ?? '') === 'p2p',
      };
    });
  }

  async sendMessage(conversationId: string, text: string): Promise<void> {
    if (!this.appId || !this.appSecret) return;
    const token = await feishuToken(this.appId, this.appSecret);
    if (!token) return;
    for (const chunk of formatForChannel('web', text)) {
      await fetch('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receive_id: conversationId,
          msg_type: 'text',
          content: JSON.stringify({ text: chunk }),
        }),
      });
    }
  }

  formatForChannel(text: string): string[] {
    return formatForChannel('web', text);
  }
}
