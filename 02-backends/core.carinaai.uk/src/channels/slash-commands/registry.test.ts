import { describe, it, expect } from 'vitest';
import { registerCommand, getCommand, listCommands } from './registry.js';
import type { SlashCommand } from './registry.js';
import { interceptSlashCommand } from './interceptor.js';
import type { InboundMessage } from '../types.js';

const noop: SlashCommand = {
  name: 'noop',
  description: 'does nothing',
  handler: async () => 'ok',
};

describe('slash command registry', () => {
  it('returns undefined for unknown command', () => {
    expect(getCommand('unknown')).toBeUndefined();
  });

  it('registers and retrieves a command', () => {
    registerCommand(noop);
    expect(getCommand('noop')).toBe(noop);
  });

  it('listCommands returns all registered', () => {
    const list = listCommands();
    expect(list.some((c) => c.name === 'noop')).toBe(true);
  });

  it('accepts Telegram group commands containing the bot username', async () => {
    const result = await interceptSlashCommand({
      channel: 'telegram',
      workerId: 'worker-1',
      workspaceId: 'workspace-1',
      contactId: 'chat-1',
      content: '/noop@CarinaBot',
      rawPayload: {},
      timestamp: new Date(),
    } satisfies InboundMessage, 'worker-1');

    expect(result).toMatchObject({ handled: true, response: 'ok' });
  });
});
