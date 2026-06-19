import { describe, expect, it, beforeEach } from 'vitest';
import {
  anthropicCacheControlBlocks,
  applyPendingInvalidation,
  clearPromptCache,
  deferPromptInvalidation,
  extractSystemPrompt,
  forceImmediateInvalidation,
  freezeSessionPrompt,
  getCachedSystemPrompt,
  getFrozenSystemPrompt,
  getPromptCacheStats,
  getSessionPromptCacheStats,
  hashPrompt,
  hasPendingInvalidation,
  openaiPromptCacheKey,
  resolveFrozenSystemPrompt,
  thawSession,
} from './prompt-cache.js';
import type { Message } from '../types/index.js';

describe('prompt-cache', () => {
  beforeEach(() => {
    clearPromptCache();
    delete process.env.CARINA_PROMPT_CACHE;
    delete process.env.CARINA_PROMPT_NOW;
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

  it('freezes prompt per session and returns same bytes on later turns', () => {
    const sessionId = 'sess-alpha';
    const prompt = 'stable persona and skills block';
    freezeSessionPrompt(sessionId, prompt, ['skill-a'], ['memory']);

    for (let turn = 2; turn <= 10; turn += 1) {
      expect(resolveFrozenSystemPrompt(sessionId)).toBe(prompt);
    }
    expect(getSessionPromptCacheStats(sessionId).hits).toBe(9);
  });

  it('keeps independent frozen prompts per session', () => {
    freezeSessionPrompt('sess-a', 'prompt-a', [], []);
    freezeSessionPrompt('sess-b', 'prompt-b', [], []);

    expect(getFrozenSystemPrompt('sess-a')).toBe('prompt-a');
    expect(getFrozenSystemPrompt('sess-b')).toBe('prompt-b');
  });

  it('applyPendingInvalidation clears freeze for next build', () => {
    const sessionId = 'sess-clear';
    freezeSessionPrompt(sessionId, 'frozen', [], []);
    deferPromptInvalidation(sessionId, 'skill installed: demo');
    expect(hasPendingInvalidation(sessionId)).toBe(true);

    const cleared = applyPendingInvalidation(sessionId);
    expect(cleared).toBe(true);
    expect(getFrozenSystemPrompt(sessionId)).toBeNull();
    expect(hasPendingInvalidation(sessionId)).toBe(false);
  });

  it('forceImmediateInvalidation clears freeze without pending flag', () => {
    const sessionId = 'sess-force';
    freezeSessionPrompt(sessionId, 'frozen', [], []);
    forceImmediateInvalidation(sessionId);
    expect(getFrozenSystemPrompt(sessionId)).toBeNull();
  });

  it('thawSession clears freeze and pending invalidation', () => {
    const sessionId = 'sess-thaw';
    freezeSessionPrompt(sessionId, 'frozen', [], []);
    deferPromptInvalidation(sessionId, 'tool registered: demo');
    thawSession(sessionId);
    expect(getFrozenSystemPrompt(sessionId)).toBeNull();
    expect(hasPendingInvalidation(sessionId)).toBe(false);
  });
});
