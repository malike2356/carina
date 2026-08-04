import { describe, expect, it } from 'vitest';
import { aivaEmptyReplyFallback, sanitizeAivaUserFacingReply } from './sanitize-aiva-reply.js';

describe('sanitizeAivaUserFacingReply', () => {
  it('strips tool status and working-set dumps', () => {
    const raw = [
      'Let me check.',
      '[using memory...]',
      '[using session-search...]',
      'Found **Mr. Alex Karikari Frempong**.',
      '',
      'Phone: **+23324 381 4009**',
      '',
      'Working set from this turn (tool evidence; prefer over older memory notes):',
      '1. contacts: {"contacts":[{"name":"1102"}]}',
    ].join('\n');

    const cleaned = sanitizeAivaUserFacingReply(raw);
    expect(cleaned).toContain('Found **Mr. Alex Karikari Frempong**.');
    expect(cleaned).toContain('Phone: **+23324 381 4009**');
    expect(cleaned).not.toContain('[using memory...]');
    expect(cleaned).not.toContain('Working set from this turn');
    expect(cleaned).not.toContain('"name":"1102"');
  });

  it('strips Called tools dumps and learning footnotes', () => {
    const cleaned = sanitizeAivaUserFacingReply(
      [
        '[Called tools: google-drive-search({ "query": "sands security" })]',
        '[Called tools: workspace-inventory({})]',
        '',
        '(noted your correction; noted, but nothing specific enough to save)',
        '',
        'I could not find matching emails yet.',
      ].join('\n'),
    );
    expect(cleaned).toBe('I could not find matching emails yet.');
    expect(cleaned).not.toContain('Called tools');
    expect(cleaned).not.toContain('noted your correction');
  });
});

describe('aivaEmptyReplyFallback', () => {
  it('points at Gmail reconnect for email asks', () => {
    const msg = aivaEmptyReplyFallback(
      'go through all my email retrospectively and find anything about the student load trust fund',
    );
    expect(msg.toLowerCase()).toContain('gmail');
    expect(msg.toLowerCase()).toContain('reconnect');
    expect(msg).not.toMatch(/what would you like me to help with/i);
  });

  it('uses a non-greeting default for other asks', () => {
    expect(aivaEmptyReplyFallback('hello')).toMatch(/blank reply/i);
  });
});
