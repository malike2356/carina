import { describe, expect, it } from 'vitest';
import {
  byokShouldDeleteInbound,
  isByokEligibleProvider,
  maskApiKey,
  normalizeByokProvider,
} from './byok-commands.js';
import type { ChannelMessage } from '../channel-adapter.interface.js';

function msg(text: string): ChannelMessage {
  return {
    id: '1',
    channel: 'telegram',
    externalUserId: '42',
    conversationId: '99',
    text,
    timestamp: new Date(),
    isDirect: true,
    isMention: false,
    isCommand: true,
  };
}

describe('Carina gateway BYOK helpers', () => {
  it('masks api keys', () => {
    expect(maskApiKey('sk-abcdefghijklmnop')).toMatch(/^sk-a…mnop$/);
  });

  it('normalizes provider aliases', () => {
    expect(normalizeByokProvider('Claude')).toBe('anthropic');
    expect(normalizeByokProvider('google')).toBe('gemini');
  });

  it('accepts common api-key providers', () => {
    expect(isByokEligibleProvider('openai')).toBe(true);
    expect(isByokEligibleProvider('deepseek')).toBe(true);
  });

  it('flags /byok set for inbound delete', () => {
    expect(byokShouldDeleteInbound(msg('/byok set deepseek sk-secret'))).toBe(true);
    expect(byokShouldDeleteInbound(msg('/byok list'))).toBe(false);
    expect(byokShouldDeleteInbound(msg('/byok clear openai'))).toBe(false);
  });
});
