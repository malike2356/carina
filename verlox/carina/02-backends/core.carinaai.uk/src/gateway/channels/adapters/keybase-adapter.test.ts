import { describe, expect, it, vi } from 'vitest';
import {
  KeybaseAdapter,
  parseKeybaseInbound,
  type KeybaseBotClient,
} from './keybase-adapter.js';

const TEAM_MESSAGE = {
  id: 42,
  channel: {
    name: 'verlox',
    topicName: 'general',
    membersType: 'team',
  },
  sender: { username: 'alice' },
  content: {
    type: 'text',
    text: { body: '@carina deploy status' },
  },
};

const DM_MESSAGE = {
  id: 43,
  channel: {
    name: 'bob',
    membersType: 'impteamnative',
  },
  sender: { username: 'bob' },
  content: {
    type: 'text',
    text: { body: '!help' },
  },
};

describe('KeybaseAdapter', () => {
  function mockBot(): KeybaseBotClient {
    return {
      init: vi.fn(async () => {}),
      deinit: vi.fn(async () => {}),
      chat: {
        send: vi.fn(async () => {}),
        watchAllChannelsForNewMessages: vi.fn(),
      },
    };
  }

  it('parseInbound extracts team channel conversation ID and mention', () => {
    const message = parseKeybaseInbound(TEAM_MESSAGE);

    expect(message?.channel).toBe('keybase');
    expect(message?.id).toBe('42');
    expect(message?.externalUserId).toBe('alice');
    expect(message?.conversationId).toBe('verlox#general');
    expect(message?.text).toBe('@carina deploy status');
    expect(message?.isDirect).toBe(false);
    expect(message?.isMention).toBe(true);
    expect(message?.isCommand).toBe(false);
  });

  it('parseInbound detects DM channels and bang commands', () => {
    const message = parseKeybaseInbound(DM_MESSAGE);

    expect(message?.conversationId).toBe('bob');
    expect(message?.isDirect).toBe(true);
    expect(message?.isCommand).toBe(true);
  });

  it('parseInbound ignores non-text content', () => {
    expect(parseKeybaseInbound({
      ...TEAM_MESSAGE,
      content: { type: 'attachment' },
    })).toBeNull();
  });

  it('start initializes keybase-bot and returns stop handle', async () => {
    const bot = mockBot();
    const adapter = new KeybaseAdapter(
      true,
      'carina-bot',
      'paper-key',
      async () => bot,
    );

    const handle = await adapter.start();
    expect(bot.init).toHaveBeenCalledWith('carina-bot', 'paper-key');
    expect(bot.chat.watchAllChannelsForNewMessages).toHaveBeenCalledOnce();
    expect(handle).toBeTruthy();

    handle?.stop();
    expect(bot.deinit).toHaveBeenCalledOnce();
  });

  it('sendMessage uses keybase-bot chat.send after start', async () => {
    const bot = mockBot();
    const adapter = new KeybaseAdapter(
      true,
      'carina-bot',
      'paper-key',
      async () => bot,
    );

    await adapter.start();
    await adapter.sendMessage('verlox#general', 'Done');

    expect(bot.chat.send).toHaveBeenCalledWith('verlox#general', { body: 'Done' });
  });
});
