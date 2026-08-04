import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  registerTelegramChatCommands,
  registerTelegramWebhook,
  telegramMenuCommands,
} from './telegram-adapter.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

function successfulTelegramResponse(result: unknown = true): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ ok: true, result }),
  } as Response;
}

describe('Telegram command menu', () => {
  it('builds the menu from the shared slash command registry', () => {
    const commands = telegramMenuCommands();
    expect(commands).toContainEqual({
      command: 'help',
      description: 'Show available slash commands',
    });
    expect(commands).toContainEqual({
      command: 'contacts',
      description: 'Search contacts or open the Contacts module',
    });
    expect(commands.some((entry) => entry.command === 'memory')).toBe(true);
    expect(commands.some((entry) => entry.command === 'voice_on')).toBe(true);
    expect(commands.some((entry) => entry.command === 'voice_off')).toBe(true);
    expect(commands.some((entry) => entry.command === 'incognito_on')).toBe(true);
    expect(commands.some((entry) => entry.command === 'incognito_off')).toBe(true);
    expect(commands.every((entry) => entry.command.length <= 32)).toBe(true);
  });

  it('registers default, private, group, and menu button scopes', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) =>
      successfulTelegramResponse(
        String(input).endsWith('/getChatMenuButton') ? { type: 'commands' } : true,
      ));
    vi.stubGlobal('fetch', fetchMock);

    await registerTelegramWebhook('123:token', 'worker-1');

    const calls = fetchMock.mock.calls.map((call) => ({
      method: String(call[0]).split('/').at(-1),
      body: JSON.parse(String((call[1] as RequestInit).body)) as Record<string, unknown>,
    }));
    expect(calls.filter((call) => call.method === 'setMyCommands')).toHaveLength(3);
    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ body: expect.objectContaining({ scope: { type: 'default' } }) }),
      expect.objectContaining({ body: expect.objectContaining({ scope: { type: 'all_private_chats' } }) }),
      expect.objectContaining({ body: expect.objectContaining({ scope: { type: 'all_group_chats' } }) }),
      expect.objectContaining({ method: 'setChatMenuButton' }),
    ]));
  });

  it('registers a command menu for a specific chat only once', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) =>
      successfulTelegramResponse(
        String(input).endsWith('/getChatMenuButton') ? { type: 'commands' } : true,
      ));
    vi.stubGlobal('fetch', fetchMock);

    await registerTelegramChatCommands('456:token', '1');
    await registerTelegramChatCommands('456:token', '1');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const menuCall = fetchMock.mock.calls[1];
    expect(JSON.parse(String((menuCall?.[1] as RequestInit).body))).toMatchObject({
      chat_id: 1,
      menu_button: { type: 'commands' },
    });
  });
});
