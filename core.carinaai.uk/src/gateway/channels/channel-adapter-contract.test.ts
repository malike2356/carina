import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ChannelMessage } from './channel-adapter.interface.js';
import { shouldAcceptGroupInbound, groupMentionRequired } from './channel-group-policy.js';
import {
  buildChannelApprovalPayload,
  channelSupportsInteractiveApproval,
  summarizeToolParamsForChannel,
} from './channel-approval-ui.js';
import {
  buildGatewaySessionMapKey,
  operatorSessionEnabled,
} from './channel-session-binding.js';
import { normalizeChannelInbound } from './channel-platform.js';
import { DiscordAdapter } from './adapters/discord-adapter.js';
import { SlackAdapter } from './adapters/slack-adapter.js';
import { TelegramAdapter } from './adapters/telegram-adapter.js';
import { channelRegistry } from './channel-registry.js';

function sampleMessage(overrides: Partial<ChannelMessage> = {}): ChannelMessage {
  return {
    id: '1',
    channel: 'slack',
    externalUserId: 'U1',
    conversationId: 'C1',
    text: 'hello team',
    timestamp: new Date(),
    isDirect: false,
    isMention: false,
    isCommand: false,
    ...overrides,
  };
}

describe('channel-group-policy', () => {
  afterEach(() => {
    delete process.env.CARINA_GROUP_OPEN;
  });

  it('accepts direct messages without mentions', () => {
    const decision = shouldAcceptGroupInbound(sampleMessage({ isDirect: true }));
    expect(decision.accept).toBe(true);
  });

  it('rejects unmentioned slack group chatter', () => {
    expect(groupMentionRequired('slack')).toBe(true);
    const decision = shouldAcceptGroupInbound(sampleMessage());
    expect(decision.accept).toBe(false);
    expect(decision.reason).toContain('mention');
  });

  it('accepts mentioned group messages', () => {
    const decision = shouldAcceptGroupInbound(sampleMessage({ isMention: true }));
    expect(decision.accept).toBe(true);
  });

  it('accepts slash commands in groups', () => {
    const decision = shouldAcceptGroupInbound(sampleMessage({ isCommand: true }));
    expect(decision.accept).toBe(true);
  });
});

describe('channel-session-binding', () => {
  const saved = process.env.CARINA_OPERATOR_SESSION;
  const savedScoping = process.env.CARINA_CHANNEL_PEER_SCOPING;

  afterEach(() => {
    if (saved === undefined) delete process.env.CARINA_OPERATOR_SESSION;
    else process.env.CARINA_OPERATOR_SESSION = saved;
    if (savedScoping === undefined) delete process.env.CARINA_CHANNEL_PEER_SCOPING;
    else process.env.CARINA_CHANNEL_PEER_SCOPING = savedScoping;
  });

  it('uses operator session key when unified sessions are enabled', () => {
    process.env.CARINA_OPERATOR_SESSION = 'true';
    expect(operatorSessionEnabled()).toBe(true);
    const key = buildGatewaySessionMapKey('agent-1', sampleMessage({ channel: 'telegram' }));
    expect(key).toBe('carina:agent:agent-1:gateway:operator');
  });

  it('scopes session keys per channel and peer by default', () => {
    delete process.env.CARINA_OPERATOR_SESSION;
    const key = buildGatewaySessionMapKey('agent-1', sampleMessage());
    expect(key).toBe('carina:agent:agent-1:gateway:slack:C1:U1');
  });
});

describe('channel-approval-ui', () => {
  it('builds Slack Block Kit approval actions', () => {
    const payload = buildChannelApprovalPayload('slack', {
      toolName: 'shell-exec',
      reason: 'Run deployment script',
    });
    expect(payload.options.blocks).toBeDefined();
    const blocks = payload.options.blocks as Array<Record<string, unknown>>;
    expect(blocks.some((b) => b.type === 'actions')).toBe(true);
  });

  it('builds Discord embed approval cards', () => {
    const payload = buildChannelApprovalPayload('discord', {
      toolName: 'file-write',
      reason: 'Overwrite config',
    });
    expect(payload.options.embeds).toBeDefined();
    expect(channelSupportsInteractiveApproval('discord')).toBe(true);
    expect(channelSupportsInteractiveApproval('sms')).toBe(false);
  });

  it('builds Telegram inline keyboard approval UI', () => {
    const payload = buildChannelApprovalPayload('telegram', {
      toolName: 'http-request',
      reason: 'POST to external API',
    });
    const markup = payload.options.replyMarkup as { inline_keyboard?: unknown[] };
    expect(markup.inline_keyboard?.length).toBeGreaterThan(0);
  });

  it('redacts sensitive params in approval summaries', () => {
    const summary = summarizeToolParamsForChannel({
      apiKey: 'secret-key',
      command: 'ls -la',
    });
    expect(summary).toContain('[REDACTED]');
    expect(summary).not.toContain('secret-key');
  });
});

describe('adapter contract', () => {
  it('DiscordAdapter ignores unmentioned server chatter', () => {
    const adapter = new DiscordAdapter(true);
    const message = adapter.parseInbound({
      id: '1',
      content: 'just chatting',
      channelId: 'chan-1',
      author: { id: 'user-1' },
      guildId: 'guild-1',
    });
    expect(message).toBeNull();
  });

  it('DiscordAdapter accepts mentioned server messages', () => {
    const adapter = new DiscordAdapter(true);
    const message = adapter.parseInbound({
      id: '2',
      content: '@Carina please summarize',
      channelId: 'chan-1',
      author: { id: 'user-1' },
      guildId: 'guild-1',
    });
    expect(message?.isMention).toBe(true);
    expect(message?.text).toContain('summarize');
  });

  it('SlackAdapter formats outbound with platform chunk limits', () => {
    const adapter = new SlackAdapter(true);
    const chunks = adapter.formatForChannel('s'.repeat(3500));
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 3000)).toBe(true);
  });

  it('TelegramAdapter uses HTML-friendly chunking via formatForChannel', () => {
    const adapter = new TelegramAdapter(true);
    const chunks = adapter.formatForChannel('t'.repeat(4100));
    expect(chunks.length).toBeGreaterThan(1);
  });
});

describe('channel-platform normalize', () => {
  beforeEach(() => {
    channelRegistry.register(new SlackAdapter(true));
  });

  it('drops group noise via shared policy', async () => {
    const result = await normalizeChannelInbound('slack', {
      event: {
        text: 'weekend plans?',
        channel: 'C-noise',
        user: 'U9',
        ts: '1',
      },
    });
    expect(result.ok).toBe(false);
  });

  it('accepts mentioned inbound through adapter + policy pipeline', async () => {
    const result = await normalizeChannelInbound('slack', {
      event: {
        text: '<@BOT> status update',
        channel: 'C-team',
        user: 'U9',
        ts: '2',
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message.isMention).toBe(true);
      expect(result.sessionBinding).toContain('slack');
    }
  });
});
