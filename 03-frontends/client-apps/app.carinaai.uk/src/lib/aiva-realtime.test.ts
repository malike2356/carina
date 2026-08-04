import { describe, expect, it } from 'vitest';
import {
  buildRealtimeInstructions,
  buildRealtimeSessionConfig,
  isRealtimeFallbackError,
  resolveOpenAiApiKey,
  safetyIdentifierFor,
} from './aiva-realtime';

describe('aiva-realtime', () => {
  it('builds spoken instructions from worker persona', () => {
    const text = buildRealtimeInstructions({
      name: 'Selorm',
      roleDescription: 'Customer Support',
      personaPrompt: 'Be warm and concise.',
    });
    expect(text).toContain('Selorm');
    expect(text).toContain('Customer Support');
    expect(text).toContain('Be warm and concise.');
  });

  it('returns a realtime session config object', () => {
    const session = buildRealtimeSessionConfig({
      name: 'Selorm',
      roleDescription: 'Support',
      personaPrompt: 'Helpful',
    });
    expect(session.type).toBe('realtime');
    expect(session.model).toBeTruthy();
    expect(session.instructions).toContain('Selorm');
  });

  it('prefers workspace OpenAI BYOK over env', () => {
    const prev = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-env-key-should-not-win-0123456789';
    try {
      const key = resolveOpenAiApiKey([
        { provider: 'openai', apiKey: 'sk-workspace-byok-key-0123456789abcd' },
      ]);
      expect(key).toBe('sk-workspace-byok-key-0123456789abcd');
    } finally {
      if (prev === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = prev;
    }
  });

  it('hashes safety identifiers stably', () => {
    const a = safetyIdentifierFor('ws-1', 'user-1');
    const b = safetyIdentifierFor('ws-1', 'user-1');
    const c = safetyIdentifierFor('ws-2', 'user-1');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toHaveLength(64);
  });

  it('detects realtime errors that should fall back to classic', () => {
    expect(isRealtimeFallbackError('insufficient_quota', 429)).toBe(true);
    expect(isRealtimeFallbackError('Realtime handshake timed out after 25s', 504)).toBe(true);
    expect(isRealtimeFallbackError('Offer did not have an audio media section', 400)).toBe(false);
  });
});
