import { describe, expect, it } from 'vitest';
import { markdownTablesToBullets } from './markdown-for-channels.js';
import { buildPlatformFormattingContext } from './platform-formatting-hints.js';

describe('markdownTablesToBullets', () => {
  it('rewrites markdown tables into bullet lines', () => {
    const input = '| Task | State |\n| --- | --- |\n| Build | Done |';
    expect(markdownTablesToBullets(input)).toBe('- Task: Build; State: Done');
  });
});

describe('buildPlatformFormattingContext', () => {
  it('warns Discord and Slack away from tables', () => {
    expect(buildPlatformFormattingContext('discord')).toContain('Do not use markdown tables');
    expect(buildPlatformFormattingContext('slack')).toContain('Do not use markdown tables');
  });

  it('asks Telegram for one cohesive spaced reply', () => {
    expect(buildPlatformFormattingContext('telegram')).toContain('blank lines between paragraphs');
    expect(buildPlatformFormattingContext('telegram')).toContain('one cohesive reply');
    expect(buildPlatformFormattingContext('telegram')).toContain('Do not narrate tool use');
  });

  it('requires plain text on WhatsApp', () => {
    expect(buildPlatformFormattingContext('whatsapp')).toContain('Plain text only');
  });
});
