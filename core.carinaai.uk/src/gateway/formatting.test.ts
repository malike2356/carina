import { describe, expect, it } from 'vitest';
import { formatForPlatform } from './formatting.js';

describe('formatForPlatform', () => {
  it('keeps Telegram markdown intact', () => {
    expect(formatForPlatform('**Bold**\n| A | B |', 'telegram')).toBe('**Bold**\n| A | B |');
  });

  it('converts markdown tables and headings for WhatsApp', () => {
    const result = formatForPlatform('## Status\n\n| Task | State |\n| --- | --- |\n| Build | Done |', 'whatsapp');

    expect(result).toContain('STATUS');
    expect(result).toContain('- Task: Build; State: Done');
  });

  it('splits long WhatsApp messages', () => {
    const result = formatForPlatform('x '.repeat(1000), 'whatsapp');

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
  });
});
