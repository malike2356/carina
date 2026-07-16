import { describe, expect, it } from 'vitest';
import { fuzzyFilter, fuzzyFilterRecords } from './fuzzy-filter.js';
import { osc8Link, stripOsc8 } from './hyperlinks.js';

describe('operator fuzzy filter', () => {
  it('ranks prefix matches ahead of substring matches', () => {
    const items = ['session-alpha', 'beta-session', 'alpha'];
    expect(fuzzyFilter(items, 'alpha')).toEqual(['alpha', 'session-alpha']);
  });

  it('filters records by selected keys', () => {
    const rows = fuzzyFilterRecords(
      [{ name: 'main', title: 'Primary' }, { name: 'dev', title: 'Sandbox' }],
      'sand',
      ['name', 'title'],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('dev');
  });
});

describe('operator hyperlinks', () => {
  it('wraps text in OSC8 sequences', () => {
    const linked = osc8Link('https://carinaai.uk', 'Carina');
    expect(linked).toContain('https://carinaai.uk');
    expect(stripOsc8(linked)).toBe('Carina');
  });
});
