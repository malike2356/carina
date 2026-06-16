import { describe, expect, it } from 'vitest';
import { formatForPlatform } from './formatting.js';

describe('formatForPlatform', () => {
  it('converts markdown tables to bullets for Telegram', () => {
    const result = formatForPlatform('| A | B |\n| --- | --- |\n| 1 | 2 |', 'telegram');
    expect(result).toContain('- A: 1; B: 2');
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
