import { describe, expect, it } from 'vitest';
import { filterSlashCommands, isSlashCommand } from './commands';

describe('commands', () => {
  it('detects slash input', () => {
    expect(isSlashCommand('/help')).toBe(true);
    expect(isSlashCommand('hello')).toBe(false);
  });

  it('returns all commands for lone slash', () => {
    expect(filterSlashCommands('/').length).toBeGreaterThan(0);
  });

  it('filters by prefix', () => {
    const matches = filterSlashCommands('/mem');
    expect(matches.some((m) => m.command === '/memories')).toBe(true);
    expect(matches.some((m) => m.command === '/clear')).toBe(false);
  });
});
