import type { IChannelAdapter } from '../channel-adapter.interface.js';
import { parseGenericWebhook } from './rest-channel-helpers.js';
import { formatForChannel } from '../channel-formatter.js';

export class MatrixAdapter implements IChannelAdapter {
  readonly name = 'matrix' as const;

  constructor(
    readonly enabled: boolean,
    private readonly homeserver = process.env.MATRIX_HOMESERVER_URL ?? '',
    private readonly token = process.env.MATRIX_ACCESS_TOKEN ?? '',
    private readonly userId = process.env.MATRIX_USER_ID ?? '',
  ) {}

  parseInbound(raw: unknown) {
    return parseGenericWebhook(raw, 'matrix', (p) => {
      const content = (p.content ?? {}) as Record<string, unknown>;
      return {
        text: String(content.body ?? p.text ?? ''),
        userId: String(p.sender ?? ''),
        conversationId: String(p.room_id ?? ''),
        messageId: String(p.event_id ?? ''),
        isDirect: String(p.room_id ?? '').includes('!'),
      };
    });
  }

  async sendMessage(conversationId: string, text: string): Promise<void> {
    if (!this.homeserver || !this.token) return;
    const txn = Date.now();
    for (const chunk of formatForChannel('web', text)) {
      await fetch(
        `${this.homeserver.replace(/\/$/, '')}/_matrix/client/v3/rooms/${encodeURIComponent(conversationId)}/send/m.room.message/${txn}`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ msgtype: 'm.text', body: chunk }),
        },
      );
    }
  }

  formatForChannel(text: string): string[] {
    return formatForChannel('web', text);
  }
}
