import type { IChannelAdapter } from '../channel-adapter.interface.js';
import { parseGenericWebhook } from './rest-channel-helpers.js';
import { formatForChannel } from '../channel-formatter.js';
import { getRouter } from '../../router.js';

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
        isDirect: p.is_direct === true || String(p.room_type ?? '') === 'dm',
        threadId: String(p.m_thread ?? p.thread_id ?? p.event_id ?? 'root'),
        senderName: String(p.sender_display_name ?? p.sender ?? ''),
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

  async start(): Promise<{ stop: () => void } | void> {
    if (!this.enabled || !this.homeserver || !this.token) return;
    if (process.env.MATRIX_SYNC_ENABLED === 'false') return;

    let running = true;
    let nextBatch = '';
    const base = this.homeserver.replace(/\/$/, '');

    const sync = async (): Promise<void> => {
      while (running) {
        try {
          const url = `${base}/_matrix/client/v3/sync?timeout=30000${nextBatch ? `&since=${nextBatch}` : ''}`;
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${this.token}` },
            signal: AbortSignal.timeout(35_000),
          });
          if (!res.ok) {
            await sleep(5000);
            continue;
          }
          const data = await res.json() as {
            next_batch?: string;
            rooms?: { join?: Record<string, { timeline?: { events?: unknown[] } }> };
          };
          if (data.next_batch) nextBatch = data.next_batch;

          const joins = data.rooms?.join ?? {};
          const gateway = getRouter();
          for (const events of Object.values(joins)) {
            for (const event of events.timeline?.events ?? []) {
              const raw = event as Record<string, unknown>;
              if (raw.sender === this.userId) continue;
              if (raw.type !== 'm.room.message') continue;
              const inbound = this.parseInbound(raw);
              if (!inbound) continue;
              const chunks: string[] = [];
              for await (const chunk of gateway.handleInbound('matrix', raw)) {
                chunks.push(chunk);
              }
              const reply = chunks.join('');
              if (reply) await this.sendMessage(inbound.conversationId, reply);
            }
          }
        } catch {
          await sleep(5000);
        }
      }
    };

    void sync();
    return { stop: () => { running = false; } };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
