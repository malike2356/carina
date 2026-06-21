import { config } from '../../../config/index.js';
import type {
  ChannelMessage,
  IChannelAdapter,
  SendOptions,
  WebhookValidationInput,
} from '../channel-adapter.interface.js';

const MAX_LENGTH = 4096;

export class NtfyAdapter implements IChannelAdapter {
  readonly name = 'ntfy' as const;

  constructor(
    readonly enabled: boolean,
    private readonly baseUrl = config.ntfy.baseUrl,
    private readonly topic = config.ntfy.topic,
    private readonly token = config.ntfy.token,
  ) {}

  parseInbound(_raw: unknown): ChannelMessage | null {
    return null;
  }

  async sendMessage(_conversationId: string, text: string, _options?: SendOptions): Promise<void> {
    if (!this.checkConfigured()) return;

    const url = `${this.baseUrl.replace(/\/$/, '')}/${this.topic}`;
    for (const chunk of this.formatForChannel(text)) {
      const headers: Record<string, string> = { 'Content-Type': 'text/plain' };
      if (this.token) {
        headers.Authorization = `Bearer ${this.token}`;
      }
      await fetch(url, {
        method: 'POST',
        headers,
        body: chunk,
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
    return Boolean(this.topic?.trim());
  }
}
