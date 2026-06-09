import type { IChannelAdapter } from '../channel-adapter.interface.js';
import { parseGenericWebhook } from './rest-channel-helpers.js';
import { formatForChannel } from '../channel-formatter.js';

export class DingTalkAdapter implements IChannelAdapter {
  readonly name = 'dingtalk' as const;

  constructor(
    readonly enabled: boolean,
    private readonly webhookUrl = process.env.DINGTALK_WEBHOOK_URL ?? '',
    private readonly secret = process.env.DINGTALK_SECRET ?? '',
  ) {}

  parseInbound(raw: unknown) {
    return parseGenericWebhook(raw, 'dingtalk', (p) => {
      const text = (p.text ?? {}) as Record<string, unknown>;
      return {
        text: String(text.content ?? p.content ?? ''),
        userId: String(p.senderId ?? p.senderStaffId ?? ''),
        conversationId: String(p.conversationId ?? p.chatId ?? 'dingtalk'),
        messageId: String(p.msgId ?? ''),
      };
    });
  }

  async sendMessage(_conversationId: string, text: string): Promise<void> {
    if (!this.webhookUrl) return;
    let url = this.webhookUrl;
    if (this.secret) {
      const timestamp = Date.now();
      const crypto = await import('crypto');
      const sign = crypto
        .createHmac('sha256', this.secret)
        .update(`${timestamp}\n${this.secret}`)
        .digest('base64');
      url += `${url.includes('?') ? '&' : '?'}timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
    }
    for (const chunk of formatForChannel('web', text)) {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ msgtype: 'text', text: { content: chunk } }),
      });
    }
  }

  formatForChannel(text: string): string[] {
    return formatForChannel('web', text);
  }
}
