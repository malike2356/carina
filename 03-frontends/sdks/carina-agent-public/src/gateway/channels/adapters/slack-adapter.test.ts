import { describe, expect, it } from 'vitest';
import { SlackAdapter } from './slack-adapter.js';

describe('SlackAdapter', () => {
  it('normalizes app mentions into ChannelMessage', () => {
    const adapter = new SlackAdapter(true);

    const message = adapter.parseInbound({
      event: {
        client_msg_id: 'm1',
        channel: 'C1',
        user: 'U1',
        text: '<@CARINA> hello',
        ts: '1700000000.000000',
      },
    });

    expect(message?.channel).toBe('slack');
    expect(message?.text).toBe('hello');
    expect(message?.isMention).toBe(true);
  });

  it('keeps direct messages without mentions', () => {
    const adapter = new SlackAdapter(true);

    const message = adapter.parseInbound({
      event: {
        channel: 'D1',
        channel_type: 'im',
        user: 'U1',
        text: 'hello',
      },
    });

    expect(message?.isDirect).toBe(true);
  });

  it('formats messages to Slack length limits', () => {
    const adapter = new SlackAdapter(true);
    const chunks = adapter.formatForChannel('s'.repeat(3500));

    expect(chunks).toHaveLength(2);
    expect(chunks.every((chunk) => chunk.length <= 3000)).toBe(true);
  });

  it('rejects unsigned webhook requests', () => {
    const adapter = new SlackAdapter(true);

    expect(adapter.validateWebhook({ headers: {}, body: {}, rawBody: '{}' })).toBe(false);
  });
});
