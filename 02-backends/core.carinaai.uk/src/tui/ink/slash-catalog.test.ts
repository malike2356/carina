import { describe, expect, it } from 'vitest';
import { filterSlashCommands, fuzzyScore } from './slash-catalog.js';

describe('slash-catalog', () => {
  it('fuzzy-matches session commands', () => {
    const commands = [
      { name: 'session list', description: 'list sessions', insert: '/session list' },
      { name: 'session resume', description: 'resume session', insert: '/session resume' },
      { name: 'help', description: 'help', insert: '/help' },
    ];
    const matches = filterSlashCommands(commands, 'ses');
    expect(matches.some((m) => m.name.startsWith('session'))).toBe(true);
  });

  it('scores prefix matches higher', () => {
    expect(fuzzyScore('session', 'ses')).toBeGreaterThan(fuzzyScore('workspace', 'ses'));
  });
});
