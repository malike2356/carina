import { describe, it, expect, beforeEach } from 'vitest';
import { registerCommand, getCommand, listCommands } from './registry.js';
import type { SlashCommand } from './registry.js';

function makeCmd(name: string): SlashCommand {
  return {
    name,
    description: `${name} command`,
    handler: async () => `${name} response`,
  };
}

describe('slash command registry', () => {
  beforeEach(() => {
    // Clear all registered commands between tests by re-importing won't work
    // since the map is module-level. We register test-specific names to avoid collision.
  });

  it('registers and retrieves a command by name', () => {
    const cmd = makeCmd('test-reg-1');
    registerCommand(cmd);
    expect(getCommand('test-reg-1')).toBe(cmd);
  });

  it('returns undefined for an unknown command', () => {
    expect(getCommand('no-such-command-xyz')).toBeUndefined();
  });

  it('listCommands returns all registered commands', () => {
    const a = makeCmd('test-list-a');
    const b = makeCmd('test-list-b');
    registerCommand(a);
    registerCommand(b);
    const names = listCommands().map((c) => c.name);
    expect(names).toContain('test-list-a');
    expect(names).toContain('test-list-b');
  });

  it('overrides an existing command when registered twice', () => {
    const original = makeCmd('test-override');
    const replacement: SlashCommand = {
      name: 'test-override',
      description: 'replaced',
      handler: async () => 'replaced response',
    };
    registerCommand(original);
    registerCommand(replacement);
    expect(getCommand('test-override')).toBe(replacement);
  });

  it('handler executes and returns a string', async () => {
    const cmd = makeCmd('test-exec');
    registerCommand(cmd);
    const found = getCommand('test-exec');
    const result = await found?.handler({} as never);
    expect(result).toBe('test-exec response');
  });
});
