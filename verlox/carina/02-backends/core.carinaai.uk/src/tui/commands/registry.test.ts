import { describe, expect, it } from 'vitest';
import {
  buildTuiCommandRegistry,
  formatArgHint,
  matchTuiCommand,
  sanitizeCommandError,
} from './registry.js';

describe('TUI command registry', () => {
  it('includes required local command metadata', () => {
    const registry = buildTuiCommandRegistry();
    const help = registry.find((command) => command.name === 'help');
    expect(help).toMatchObject({
      aliases: ['?'],
      source: 'local',
      handlerKind: 'local',
      dangerLevel: 'safe',
    });
    expect(registry.find((command) => command.name === 'doctor')?.handlerKind).toBe('backend');
  });

  it('matches aliases and preserves argument text', () => {
    const match = matchTuiCommand('/provider list');
    expect(match?.definition.name).toBe('model');
    expect(match?.alias).toBe('provider');
    expect(match?.argText).toBe('list');
  });

  it('formats argument hints for the slash menu', () => {
    const registry = buildTuiCommandRegistry();
    const skin = registry.find((command) => command.name === 'skin');
    expect(skin ? formatArgHint(skin) : '').toBe('[theme name]');
  });

  it('sanitizes implementation details from command errors', () => {
    const message = sanitizeCommandError(
      new Error('failed token=abc123 sk_test_1234567890 user adad9243-955c-42d1-a876-4c806e554679\nstack trace'),
    );
    expect(message).toContain('token=[redacted]');
    expect(message).toContain('[secret]');
    expect(message).toContain('[id]');
    expect(message).not.toContain('stack trace');
  });
});
