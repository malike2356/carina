import { describe, expect, it } from 'vitest';
import {
  chunkTelegramOutbound,
  ensureTelegramParagraphSpacing,
  markdownToTelegramHtml,
  markdownToTelegramReadable,
  stripTelegramToolStatus,
} from './telegram-format.js';

describe('telegram-format', () => {
  it('converts headings and bold into readable plain text', () => {
    const plain = markdownToTelegramReadable('## Hello\n\nThis is **bold** and *italic*.');
    expect(plain).not.toMatch(/[#*]/);
    expect(plain).toContain('Hello');
    expect(plain).toContain('This is bold and italic.');
  });

  it('converts headings and bold into Telegram HTML', () => {
    const html = markdownToTelegramHtml('## Hello\n\nThis is **bold** and a [link](https://example.com).');
    expect(html).toContain('<b>Hello</b>');
    expect(html).toContain('<b>bold</b>');
    expect(html).toContain('<a href="https://example.com">link</a>');
    expect(html).not.toContain('##');
    expect(html).not.toContain('**');
  });

  it('strips tool status lines and restores paragraph spacing', () => {
    const raw = [
      'Let me look into that.',
      '[using web-search...]',
      '[using web-search...]',
      'Ceremonies run 21 to 30 July.',
      'Tomorrow wraps up with dental professions.',
    ].join('\n');

    expect(stripTelegramToolStatus(raw)).not.toContain('[using');
    const spaced = ensureTelegramParagraphSpacing(stripTelegramToolStatus(raw));
    expect(spaced).toContain('Let me look into that.\n\nCeremonies run 21 to 30 July.\n\nTomorrow');
  });

  it('keeps normal replies as a single Telegram message', () => {
    const long = [
      'Opening summary that sets the scene for the week.',
      '## Today',
      '- Accountancy at 10am',
      '## Tomorrow',
      '- Environment at 10am',
      '- Medicine at 1pm',
      '- Dental at 4pm',
      'Want me to check a specific graduate?',
    ].join('\n\n');

    const chunks = chunkTelegramOutbound(long);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.parseMode).toBe('HTML');
    expect(chunks[0]!.text).toContain('<b>Today</b>');
    expect(chunks[0]!.text).toContain('\n\n');
    expect(chunks[0]!.text).not.toContain('##');
  });

  it('chunks oversized replies while preserving HTML mode', () => {
    const long = Array.from({ length: 40 }, (_, i) => `## Section ${i}\n\nParagraph ${i} with **emphasis**.`).join('\n\n');
    const chunks = chunkTelegramOutbound(long, 500);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.parseMode).toBe('HTML');
      expect(chunk.text).not.toContain('##');
      expect(chunk.plain).toBeTruthy();
    }
  });
});
