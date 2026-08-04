import type { IChannelAdapter, SendOptions, WebhookValidationInput } from '../channel-adapter.interface.js';
import { parseGenericWebhook } from './rest-channel-helpers.js';
import { formatForChannel } from '../channel-formatter.js';

export class HomeAssistantChannelAdapter implements IChannelAdapter {
  readonly name = 'homeassistant' as const;

  constructor(
    readonly enabled: boolean,
    private readonly baseUrl = process.env.HOMEASSISTANT_URL ?? '',
    private readonly token = process.env.HOMEASSISTANT_TOKEN ?? '',
    private readonly notifyService = process.env.HA_CHANNEL_NOTIFY_SERVICE ?? 'notify',
    private readonly webhookSecret = process.env.HA_CHANNEL_WEBHOOK_SECRET ?? '',
  ) {}

  parseInbound(raw: unknown) {
    return parseGenericWebhook(raw, 'homeassistant', (p) => {
      const event = (p.event ?? p) as Record<string, unknown>;
      const data = (event.data ?? p.data ?? p) as Record<string, unknown>;
      return {
        text: String(
          data.text ?? data.user_input ?? data.message ?? p.text ?? p.user_input ?? '',
        ),
        userId: String(data.user_id ?? data.sender_id ?? p.user_id ?? 'ha-user'),
        conversationId: String(
          data.conversation_id ?? data.session_id ?? data.user_id ?? p.conversation_id ?? 'ha-default',
        ),
        messageId: String(data.id ?? p.id ?? ''),
        isDirect: true,
      };
    });
  }

  async sendMessage(conversationId: string, text: string, _options?: SendOptions): Promise<void> {
    if (!this.baseUrl || !this.token) return;
    const [domain, service] = this.notifyService.includes('.')
      ? this.notifyService.split('.', 2)
      : ['notify', this.notifyService || 'notify'];
    const url = `${this.baseUrl.replace(/\/$/, '')}/api/services/${domain}/${service}`;
    for (const chunk of formatForChannel('web', text)) {
      await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: chunk,
          title: 'Carina',
          data: { conversation_id: conversationId },
        }),
        signal: AbortSignal.timeout(15_000),
      });
    }
  }

  formatForChannel(text: string): string[] {
    return formatForChannel('web', text);
  }

  validateWebhook(input: WebhookValidationInput): boolean {
    if (!this.webhookSecret) return true;
    const header = String(input.headers['x-ha-channel-secret'] ?? input.headers['authorization'] ?? '');
    return header === this.webhookSecret || header === `Bearer ${this.webhookSecret}`;
  }
}
