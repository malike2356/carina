import { config } from '../../../config/index.js';
import type {
  ChannelMessage,
  IChannelAdapter,
  SendOptions,
  WebhookValidationInput,
} from '../channel-adapter.interface.js';

const MAX_LENGTH = 4000;

export class GotifyAdapter implements IChannelAdapter {
  readonly name = 'gotify' as const;

  constructor(
    readonly enabled: boolean,
    private readonly gotifyUrl = config.gotify.url,
    private readonly token = config.gotify.token,
  ) {}

  parseInbound(_raw: unknown): ChannelMessage | null {
    return null;
  }

  async sendMessage(_conversationId: string, text: string, _options?: SendOptions): Promise<void> {
    if (!this.checkConfigured()) return;

    const url = `${this.gotifyUrl.replace(/\/$/, '')}/message`;
    for (const chunk of this.formatForChannel(text)) {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gotify-Key': this.token,
        },
        body: JSON.stringify({
          title: 'Carina',
          message: chunk,
          priority: 5,
        }),
        signal: AbortSignal.timeout(15_000),
      });
    }
  }

  formatForChannel(text: string): string[] {
    return [text.slice(0, MAX_LENGTH)];
  }

  validateWebhook(_input: WebhookValidationInput): boolean {
    return true;
  }

  checkConfigured(): boolean {
    return Boolean(this.gotifyUrl?.trim() && this.token?.trim());
  }
}
