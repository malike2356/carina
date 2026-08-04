import type { IChannelAdapter } from '../channel-adapter.interface.js';
import { parseGenericWebhook } from './rest-channel-helpers.js';
import { formatForChannel } from '../channel-formatter.js';

export class IMessageAdapter implements IChannelAdapter {
  readonly name = 'imessage' as const;

  constructor(
    readonly enabled: boolean,
    private readonly apiUrl = process.env.BLUEBUBBLES_URL ?? process.env.IMESSAGE_API_URL ?? '',
    private readonly password = process.env.BLUEBUBBLES_PASSWORD ?? process.env.IMESSAGE_API_KEY ?? '',
  ) {}

  parseInbound(raw: unknown) {
    return parseGenericWebhook(raw, 'imessage', (p) => {
      const data = (p.data ?? p) as Record<string, unknown>;
      return {
        text: String(data.text ?? data.message ?? p.text ?? ''),
        userId: String(data.handle ?? data.sender ?? ''),
        conversationId: String(data.chatGuid ?? data.chat_guid ?? data.handle ?? ''),
        messageId: String(data.guid ?? data.id ?? ''),
        isDirect: true,
      };
    });
  }

  async sendMessage(conversationId: string, text: string): Promise<void> {
    if (!this.apiUrl) return;
    const base = this.apiUrl.replace(/\/$/, '');
    for (const chunk of formatForChannel('web', text)) {
      const url = new URL(`${base}/api/v1/message/text`);
      if (this.password) url.searchParams.set('password', this.password);
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatGuid: conversationId, message: chunk }),
      });
    }
  }

  formatForChannel(text: string): string[] {
    return formatForChannel('web', text);
  }
}
