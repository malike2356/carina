import { describe, expect, it } from 'vitest';
import { redactSecrets, redactString } from './redact.js';

describe('redact', () => {
  it('redacts sensitive keys and nested values', () => {
    const input = {
      apiKey: 'sk-test',
      nested: { openai_api_key: 'sk-abc' },
      prompt: 'my key is sk-leaked',
      note: 'ok',
    };
    const out = redactSecrets(input) as Record<string, unknown>;
    expect(out.apiKey).toBe('[REDACTED]');
    expect((out.nested as Record<string, unknown>).openai_api_key).toBe('[REDACTED]');
    expect(out.prompt).toBe('my key is [REDACTED]');
    expect(out.note).toBe('ok');
  });

  it('redacts carina_ token patterns in strings', () => {
    expect(redactString('use carina_live_abc123 here')).toBe('use [REDACTED] here');
  });

  it('walks arrays', () => {
    const out = redactSecrets([{ token: 'secret-value' }, 'sk-inline']) as unknown[];
    expect((out[0] as Record<string, unknown>).token).toBe('[REDACTED]');
    expect(out[1]).toBe('[REDACTED]');
  });
});
