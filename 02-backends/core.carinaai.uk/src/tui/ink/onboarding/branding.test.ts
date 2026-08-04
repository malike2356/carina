import { describe, expect, it } from 'vitest';
import { CARINA_COMMAND_CENTER_MARK, TAGLINE, TAGLINE_QUOTE } from './branding.js';

describe('Carina TUI branding', () => {
  it('keeps the Command Center splash Carina-native', () => {
    expect(CARINA_COMMAND_CENTER_MARK).toContain('CARINA');
    expect(CARINA_COMMAND_CENTER_MARK).toContain('COMMAND');
    expect(TAGLINE).toBe('Your AI Command Center.');
    expect(TAGLINE_QUOTE.toLowerCase()).not.toContain('keprix');
    expect(TAGLINE_QUOTE.toLowerCase()).not.toContain('hermes');
  });
});
