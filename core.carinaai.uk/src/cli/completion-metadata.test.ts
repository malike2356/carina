import { describe, expect, it } from 'vitest';
import {
  NESTED_OPTIONS,
  SUBCOMMANDS,
  TOP_LEVEL_COMMANDS,
  nestedOptionsFor,
  subcommandsFor,
} from './completion-metadata.js';
import { buildBashCompletionScript, buildFishCompletionScript } from './commands/completion-cli.js';

describe('completion metadata', () => {
  it('lists top-level commands', () => {
    expect(TOP_LEVEL_COMMANDS.length).toBeGreaterThanOrEqual(30);
    expect(TOP_LEVEL_COMMANDS).toContain('model');
    expect(TOP_LEVEL_COMMANDS).toContain('tools');
  });

  it('defines subcommands for model and tools', () => {
    expect(subcommandsFor('model')).toContain('menu');
    expect(subcommandsFor('tools')).toContain('menu');
    expect(subcommandsFor('config')).toContain('migrate');
  });

  it('defines nested provider options for model set', () => {
    const opts = nestedOptionsFor('model', 'set');
    expect(opts).toContain('deepseek');
    expect(opts).toContain('anthropic');
  });

  it('generates bash completion with subcommand cases', () => {
    const script = buildBashCompletionScript();
    expect(script).toContain('_carina_complete');
    expect(script).toContain('model');
    expect(script).toContain('menu');
    for (const cmd of Object.keys(SUBCOMMANDS)) {
      expect(script).toContain(`${cmd})`);
    }
  });

  it('generates fish completion for channels setup', () => {
    const script = buildFishCompletionScript();
    expect(script).toContain('telegram');
    expect(script).toContain('carina completion dynamic session-id');
    expect(NESTED_OPTIONS.channels?.setup).toContain('discord');
  });
});
