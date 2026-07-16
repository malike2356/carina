import { describe, expect, it } from 'vitest';
import {
  defaultThinkingLevel,
  isFastThinkingLevel,
  mapThinkingLevelToProvider,
  parseThinkingLevel,
  resolveModelDefaultThinking,
} from './thinking-levels.js';

describe('thinking-levels', () => {
  it('parses valid thinking levels', () => {
    expect(parseThinkingLevel('high')).toBe('high');
    expect(parseThinkingLevel(' ADAPTIVE ')).toBe('adaptive');
    expect(parseThinkingLevel('invalid')).toBeNull();
  });

  it('maps anthropic thinking budgets', () => {
    const extras = mapThinkingLevelToProvider('medium', 'anthropic');
    expect(extras).toEqual({ thinking: { type: 'enabled', budget_tokens: 2048 } });
  });

  it('maps openai reasoning effort', () => {
    expect(mapThinkingLevelToProvider('minimal', 'openai')).toEqual({ reasoning_effort: 'minimal' });
    expect(mapThinkingLevelToProvider('max', 'openrouter')).toEqual({ reasoning_effort: 'high' });
  });

  it('disables thinking when off', () => {
    expect(mapThinkingLevelToProvider('off', 'anthropic')).toEqual({ enabled: false });
    expect(isFastThinkingLevel('off')).toBe(true);
  });

  it('resolves model defaults', () => {
    expect(resolveModelDefaultThinking('anthropic', 'claude-opus-4-6')).toBe('high');
    expect(resolveModelDefaultThinking('local', 'llama-3.3')).toBe('minimal');
    expect(defaultThinkingLevel()).toBe('medium');
  });
});
