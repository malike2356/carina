import { afterEach, describe, expect, it } from 'vitest';
import { config } from '../../../config/index.js';
import { SlackAdapter } from './slack-adapter.js';
import {
  bindChannelAgent,
  resetChannelAgentBindingsForTests,
} from '../../../agents/ambient/channel-agent-bindings.js';
import {
  getAmbientChannelSettings,
  resetAmbientChannelSettingsForTests,
  saveAmbientChannelSettings,
} from '../../../agents/ambient/ambient-channel-settings.js';
import { buildThreadContextSuffix, fetchSlackThreadContext } from '../../../agents/ambient/slack-thread-context.js';

describe('@Carina channel trigger', () => {
  afterEach(() => {
    resetAmbientChannelSettingsForTests();
    resetChannelAgentBindingsForTests();
    config.ambient.enabled = false;
  });

  it('responds in thread when @mentioned in channel', () => {
    const adapter = new SlackAdapter(true);
    const message = adapter.parseInbound({
      event: {
        channel: 'C1',
        channel_type: 'channel',
        user: 'U1',
        text: '<@BOT> hello',
        ts: '1700000000.000000',
        thread_ts: '1700000000.000000',
      },
    });
    expect(message?.isMention).toBe(true);
    expect(message?.threadId).toBe('1700000000.000000');
  });

  it('strips @Carina mention from message text', () => {
    const adapter = new SlackAdapter(true);
    const message = adapter.parseInbound({
      event: {
        channel: 'C1',
        channel_type: 'channel',
        user: 'U1',
        text: '<@BOT> summarize the rollout',
        ts: '1700000000.000000',
      },
    });
    expect(message?.text).toBe('summarize the rollout');
  });

  it('does not use channel context for DMs', () => {
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

  it('reads full thread context when mentioned inside a thread', async () => {
    const context = await fetchSlackThreadContext({
      replies: async () => ({
        messages: [
          { user: 'U2', text: 'What is the status?' },
          { user: 'U1', text: 'Still blocked on DNS.' },
        ],
      }),
    }, 'C1', '1700000000.000000');
    expect(context).toContain('blocked on DNS');
    expect(buildThreadContextSuffix(context)).toContain('Thread Context');
  });

  it('resolves correct agent per channel binding', async () => {
    await bindChannelAgent('C1', '#eng', 'research-agent');
    const { resolveChannelAgentBinding } = await import('../../../agents/ambient/channel-agent-bindings.js');
    expect(await resolveChannelAgentBinding('C1')).toBe('research-agent');
  });

  it('respects channel response mode config', async () => {
    const settings = await getAmbientChannelSettings('C1', '#eng');
    settings.responseMode = 'ephemeral';
    await saveAmbientChannelSettings(settings);
    const loaded = await getAmbientChannelSettings('C1');
    expect(loaded.responseMode).toBe('ephemeral');
  });
});

describe('DM behaviour', () => {
  it('responds privately to DMs without mention requirement', () => {
    const adapter = new SlackAdapter(true);
    const message = adapter.parseInbound({
      event: {
        channel: 'D1',
        channel_type: 'im',
        user: 'U1',
        text: 'private question',
      },
    });
    expect(message?.isDirect).toBe(true);
    expect(message?.isMention).toBe(false);
  });
});
