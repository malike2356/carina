import { describe, expect, it } from 'vitest';
import { CHARS_PER_CHUNK, chunkAuto, chunkMarkdown, chunkPlainText } from './chunk-text.js';

describe('chunkMarkdown', () => {
  it('returns empty array for empty string', () => {
    expect(chunkMarkdown('')).toEqual([]);
  });

  it('returns single chunk when content is under limit', () => {
    const content = '# Section\n\nShort content.';
    const chunks = chunkMarkdown(content);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain('Section');
  });

  it('splits two large heading sections into two chunks', () => {
    const bigSection = 'x'.repeat(CHARS_PER_CHUNK);
    const content = `# Section A\n\n${bigSection}\n\n# Section B\n\nAnother section.`;
    const chunks = chunkMarkdown(content);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0]).toContain('Section A');
    expect(chunks[chunks.length - 1]).toContain('Section B');
  });

  it('returns one chunk for plain text with no headings (use chunkPlainText for multi-chunk splitting)', () => {
    const para1 = 'p'.repeat(CHARS_PER_CHUNK - 50);
    const para2 = 'q'.repeat(200);
    const content = `${para1}\n\n${para2}`;
    const chunks = chunkMarkdown(content);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });
});

describe('chunkPlainText', () => {
  it('returns single chunk for short content', () => {
    const chunks = chunkPlainText('Hello world.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe('Hello world.');
  });

  it('splits long paragraphs into multiple chunks', () => {
    const long = 'a'.repeat(CHARS_PER_CHUNK - 50);
    const content = `${long}\n\n${'b'.repeat(300)}`;
    const chunks = chunkPlainText(content);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });
});

describe('chunkAuto', () => {
  it('uses markdown chunker when mimeHint is markdown', () => {
    const content = '# Heading\n\nContent here.';
    const chunks = chunkAuto(content, 'markdown');
    expect(chunks).toHaveLength(1);
  });

  it('uses markdown chunker when content has heading syntax', () => {
    const content = '# Title\n\nSome text.';
    const chunks = chunkAuto(content);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain('Title');
  });

  it('uses plain text chunker for plain content', () => {
    const content = 'No headings here. Just plain text.';
    const chunks = chunkAuto(content);
    expect(chunks).toHaveLength(1);
  });
});
