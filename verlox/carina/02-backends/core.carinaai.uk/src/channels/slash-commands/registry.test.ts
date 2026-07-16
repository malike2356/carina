import { describe, it, expect } from 'vitest';
import { registerCommand, getCommand, listCommands } from './registry.js';
import type { SlashCommand } from './registry.js';

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
});
