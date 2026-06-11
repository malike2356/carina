import type { IChannelAdapter } from '../channel-adapter.interface.js';
import { parseGenericWebhook } from './rest-channel-helpers.js';
import { formatForChannel } from '../channel-formatter.js';
import { emailSendTool } from '../../../tools/email.js';

export class EmailChannelAdapter implements IChannelAdapter {
  readonly name = 'email' as const;

  constructor(
    readonly enabled: boolean,
    private readonly inboundSecret = process.env.EMAIL_CHANNEL_WEBHOOK_SECRET ?? '',
  ) {}

  parseInbound(raw: unknown) {
    return parseGenericWebhook(raw, 'email', (p) => ({
      text: String(p.text ?? p.body ?? p.stripped_text ?? ''),
      userId: String(p.from ?? p.sender ?? ''),
      conversationId: String(p.from ?? p.sender ?? ''),
      messageId: String(p.message_id ?? p.id ?? ''),
      isDirect: true,
    }));
  }

  async sendMessage(conversationId: string, text: string): Promise<void> {
    const subject = 'Carina reply';
    await emailSendTool.execute({
      to: conversationId,
      subject,
      body: text,
      _confirmed: true,
    });
  }

  formatForChannel(text: string): string[] {
    return formatForChannel('web', text);
  }

  validateWebhook(input: { headers: Record<string, string | string[] | undefined> }): boolean {
    if (!this.inboundSecret) {
      return process.env.NODE_ENV !== 'production';
    }
    const sig = String(input.headers['x-email-channel-secret'] ?? '');
    return sig === this.inboundSecret;
  }
}
