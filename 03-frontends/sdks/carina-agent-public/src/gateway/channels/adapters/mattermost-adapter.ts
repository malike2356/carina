import type { IChannelAdapter } from '../channel-adapter.interface.js';
import { parseGenericWebhook } from './rest-channel-helpers.js';
import { formatForChannel } from '../channel-formatter.js';

export class MattermostAdapter implements IChannelAdapter {
  readonly name = 'mattermost' as const;

  constructor(
    readonly enabled: boolean,
    private readonly serverUrl = process.env.MATTERMOST_URL ?? '',
    private readonly token = process.env.MATTERMOST_TOKEN ?? '',
  ) {}

  parseInbound(raw: unknown) {
    return parseGenericWebhook(raw, 'mattermost', (p) => ({
      text: String(p.text ?? ''),
      userId: String(p.user_id ?? p.user_name ?? ''),
      conversationId: String(p.channel_id ?? ''),
      messageId: String(p.id ?? p.post_id ?? ''),
      isDirect: String(p.channel_type ?? '') === 'D',
    }));
  }

  async sendMessage(conversationId: string, text: string): Promise<void> {
    if (!this.serverUrl || !this.token) return;
    for (const chunk of formatForChannel('web', text)) {
      await fetch(`${this.serverUrl.replace(/\/$/, '')}/api/v4/posts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: conversationId, message: chunk }),
      });
    }
  }

  formatForChannel(text: string): string[] {
    return formatForChannel('web', text);
  }
}
