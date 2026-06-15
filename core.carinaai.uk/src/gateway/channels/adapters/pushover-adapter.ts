import { config } from '../../../config/index.js';
import type {
  ChannelMessage,
  IChannelAdapter,
  SendOptions,
  WebhookValidationInput,
} from '../channel-adapter.interface.js';

const MAX_LENGTH = 1024;
const PUSHOVER_API_URL = 'https://api.pushover.net/1/messages.json';

export class PushoverAdapter implements IChannelAdapter {
  readonly name = 'pushover' as const;

  constructor(
    readonly enabled: boolean,
    private readonly token = config.pushover.token,
    private readonly user = config.pushover.user,
  ) {}

  parseInbound(_raw: unknown): ChannelMessage | null {
    return null;
  }

  async sendMessage(_conversationId: string, text: string, _options?: SendOptions): Promise<void> {
    if (!this.checkConfigured()) return;

    for (const chunk of this.formatForChannel(text)) {
      await fetch(PUSHOVER_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          token: this.token,
          user: this.user,
          message: chunk,
          title: 'Carina',
        }).toString(),
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
    return Boolean(this.token?.trim() && this.user?.trim());
  }
}
