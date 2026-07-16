import { afterEach, describe, expect, it } from 'vitest';
import { config } from '../../../config/index.js';
import { SlackAdapter } from './slack-adapter.js';

describe('Slack ambient mode', () => {
  const previous = { ...config.ambient };

  afterEach(() => {
    Object.assign(config.ambient, previous);
    config.ambient.slack = { ...previous.slack };
  });

  it('ingests channel messages when ambient mode enabled', async () => {
    config.ambient.enabled = true;
    config.ambient.slack.passiveReading = true;
    const adapter = new SlackAdapter(true);
    const passive = await adapter.parsePassiveInbound({
      event: {
        channel: 'C1',
        channel_type: 'channel',
        user: 'U1',
        text: 'The rollout is blocked waiting on DNS.',
        ts: '1700000000.000000',
      },
    });
    expect(passive?.channelId).toBe('C1');
    expect(passive?.text).toContain('blocked');
  });

  it('skips channel messages when ambient mode disabled', async () => {
    config.ambient.enabled = false;
    const adapter = new SlackAdapter(true);
    expect(await adapter.parsePassiveInbound({
      event: {
        channel: 'C1',
        channel_type: 'channel',
        user: 'U1',
        text: 'General update',
      },
    })).toBeNull();
  });

  it('handles app_mention normally regardless of ambient mode', () => {
    config.ambient.enabled = true;
    const adapter = new SlackAdapter(true);
    const mention = adapter.parseInbound({
      event: {
        channel: 'C1',
        channel_type: 'channel',
        user: 'U1',
        text: '<@BOT> hello',
        ts: '1700000000.000000',
      },
    });
    expect(mention?.isMention).toBe(true);
    expect(mention?.text).toBe('hello');
  });

  it('strips bot messages and passive path ignores mentions', async () => {
    config.ambient.enabled = true;
    config.ambient.slack.passiveReading = true;
    const adapter = new SlackAdapter(true);
    expect(await adapter.parsePassiveInbound({
      event: {
        channel: 'C1',
        channel_type: 'channel',
        user: 'U1',
        text: '<@BOT> hello',
      },
    })).toBeNull();
    expect(adapter.parseInbound({
      event: {
        channel: 'C1',
        channel_type: 'channel',
        user: 'U1',
        text: 'hello',
        bot_id: 'B1',
      },
    })).toBeNull();
  });
});
