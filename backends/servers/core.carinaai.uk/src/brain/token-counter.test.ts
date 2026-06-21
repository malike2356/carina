import { describe, expect, it } from 'vitest';
import { countMessageTokens, countTokens, mergeTokenUsage } from './token-counter.js';

describe('token-counter', () => {
  it('estimates tokens from text', () => {
    const result = countTokens('hello world from carina');
    expect(result.tokens).toBeGreaterThan(0);
    expect(result.method).toBe('heuristic');
  });

  it('prefers provider usage when present', () => {
    const merged = mergeTokenUsage(120, 'ignored text');
    expect(merged.method).toBe('provider');
    expect(merged.tokens).toBe(120);
  });

  it('counts message arrays with overhead', () => {
    const result = countMessageTokens([
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' },
    ]);
    expect(result.tokens).toBeGreaterThan(2);
  });
});
