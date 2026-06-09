import { describe, expect, it, beforeEach } from 'vitest';
import {
  anthropicCacheControlBlocks,
  clearPromptCache,
  extractSystemPrompt,
  getCachedSystemPrompt,
  getPromptCacheStats,
  hashPrompt,
  openaiPromptCacheKey,
} from './prompt-cache.js';
import type { Message } from '../types/index.js';

describe('prompt-cache', () => {
  beforeEach(() => {
    clearPromptCache();
    delete process.env.CARINA_PROMPT_CACHE;
  });

  it('hashes prompts deterministically', () => {
    expect(hashPrompt('hello')).toBe(hashPrompt('hello'));
    expect(hashPrompt('hello')).not.toBe(hashPrompt('hello!'));
  });

  it('extracts system messages', () => {
    const messages: Message[] = [
      { role: 'system', content: 'rules', timestamp: new Date() },
      { role: 'user', content: 'hi', timestamp: new Date() },
    ];
    expect(extractSystemPrompt(messages)).toBe('rules');
  });

  it('caches repeated system prompts', () => {
    const messages: Message[] = [
      { role: 'system', content: 'same context block', timestamp: new Date() },
    ];
    const first = getCachedSystemPrompt(messages);
    const second = getCachedSystemPrompt(messages);
    expect(first.hit).toBe(false);
    expect(second.hit).toBe(true);
    expect(getPromptCacheStats().hits).toBe(1);
  });

  it('adds anthropic cache_control when enabled', () => {
    process.env.CARINA_PROMPT_CACHE = 'true';
    const blocks = anthropicCacheControlBlocks('static instructions here');
    expect(blocks[0].cache_control?.type).toBe('ephemeral');
  });

  it('skips anthropic cache_control by default', () => {
    const blocks = anthropicCacheControlBlocks('plain');
    expect(blocks[0].cache_control).toBeUndefined();
  });

  it('returns openai cache key when enabled', () => {
    process.env.CARINA_PROMPT_CACHE = 'true';
    expect(openaiPromptCacheKey('abc')).toHaveLength(32);
  });
});
