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

  it('asks Telegram for short SPEED MODE replies', () => {
    expect(buildPlatformFormattingContext('telegram')).toContain('SPEED MODE');
    expect(buildPlatformFormattingContext('telegram')).toContain('under ~600 characters');
    expect(buildPlatformFormattingContext('telegram')).toContain('Never write chain-of-thought');
    expect(buildPlatformFormattingContext('telegram')).toContain('Never narrate tool use');
  });

  it('requires plain text on WhatsApp', () => {
    expect(buildPlatformFormattingContext('whatsapp')).toContain('Plain text only');
    expect(buildPlatformFormattingContext('whatsapp')).toContain('SPEED MODE');
  });
});
