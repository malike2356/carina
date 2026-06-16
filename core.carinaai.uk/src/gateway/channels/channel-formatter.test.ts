import { describe, expect, it } from 'vitest';
import { formatForChannel } from './channel-formatter.js';

describe('formatForChannel', () => {
  it('splits Discord messages at 2000 characters and wraps bare URLs', () => {
    const chunks = formatForChannel('discord', `${'a'.repeat(1990)} https://example.com`);

    expect(chunks.every((chunk) => chunk.length <= 2000)).toBe(true);
    expect(chunks.join(' ')).toContain('<https://example.com>');
  });

  it('converts markdown tables to bullets for Discord', () => {
    const chunks = formatForChannel('discord', '| Name | Value |\n| --- | --- |\n| Port | 3333 |');
    expect(chunks[0]).toContain('- Name: Port; Value: 3333');
  });

  it('splits Slack messages at 3000 characters', () => {
    const chunks = formatForChannel('slack', 's'.repeat(3500));

    expect(chunks).toHaveLength(2);
    expect(chunks.every((chunk) => chunk.length <= 3000)).toBe(true);
  });

  it('splits Telegram messages at 4096 characters', () => {
    const chunks = formatForChannel('telegram', 't'.repeat(4100));

    expect(chunks).toHaveLength(2);
    expect(chunks[0].length).toBe(4096);
  });

  it('strips markdown for SMS and keeps chunks within 160 characters', () => {
    const chunks = formatForChannel('sms', `**${'x'.repeat(200)}**`);

    expect(chunks.every((chunk) => chunk.length <= 160)).toBe(true);
    expect(chunks.join('')).not.toContain('**');
  });
});
