import { describe, expect, it } from 'vitest';
import {
  BYOK_PROVIDER_HINTS,
  byokShouldDeleteInbound,
  isByokEligibleProvider,
  maskApiKey,
  normalizeByokProvider,
} from './byok-commands.js';
import type { InboundMessage } from '../types.js';

function msg(content: string): InboundMessage {
  return {
    channel: 'telegram',
    workerId: 'w1',
    workspaceId: 'ws1',
    contactId: '1',
    content,
    rawPayload: {},
    timestamp: new Date(),
  };
}

describe('byok slash helpers', () => {
  it('masks api keys', () => {
    expect(maskApiKey('sk-abcdefghijklmnop')).toMatch(/^sk-a…mnop$/);
    expect(maskApiKey('short')).toBe('****');
  });

  it('normalizes provider aliases', () => {
    expect(normalizeByokProvider('Google')).toBe('gemini');
    expect(normalizeByokProvider('claude')).toBe('anthropic');
    expect(normalizeByokProvider('chatgpt')).toBe('openai');
    expect(normalizeByokProvider('deepseek')).toBe('deepseek');
  });

  it('accepts common api-key providers', () => {
    expect(isByokEligibleProvider('deepseek')).toBe(true);
    expect(isByokEligibleProvider('openai')).toBe(true);
    expect(isByokEligibleProvider('anthropic')).toBe(true);
    expect(isByokEligibleProvider('gemini')).toBe(true);
    expect(isByokEligibleProvider('custom')).toBe(true);
  });

  it('rejects oauth / external-cli style providers', () => {
    expect(isByokEligibleProvider('openai-codex')).toBe(false);
  });

  it('flags set subcommands for inbound delete', () => {
    expect(byokShouldDeleteInbound(msg('/byok set deepseek sk-secret'))).toBe(true);
    expect(byokShouldDeleteInbound(msg('/byok list'))).toBe(false);
    expect(byokShouldDeleteInbound(msg('/byok clear openai'))).toBe(false);
  });

  it('exposes curated provider hints', () => {
    expect(BYOK_PROVIDER_HINTS).toContain('deepseek');
    expect(BYOK_PROVIDER_HINTS).toContain('openai');
  });
});
