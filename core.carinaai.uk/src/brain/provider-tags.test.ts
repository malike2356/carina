import { describe, expect, it } from 'vitest';
import { PROVIDER_DEFINITIONS, PROVIDER_MAP, buildProviderTagsMap } from './provider-registry.js';
import { buildRoutingTags, describeProviderTags, isOperatorFreeProvider } from './provider-tags.js';

describe('provider-tags', () => {
  it('tags every registered provider', () => {
    const map = buildProviderTagsMap();
    expect(Object.keys(map).sort()).toEqual(PROVIDER_DEFINITIONS.map((d) => d.name).sort());
  });

  it('marks local providers as local cost', () => {
    for (const name of ['ollama', 'lmstudio', 'vllm']) {
      expect(PROVIDER_MAP[name]?.tags.cost).toBe('local');
    }
  });

  it('does not mark paid cloud providers as local or free', () => {
    for (const name of ['deepseek', 'anthropic', 'openai']) {
      const cost = PROVIDER_MAP[name]?.tags.cost;
      expect(cost).toBe('byo-key');
    }
  });

  it('builds readable tag descriptions', () => {
    const text = describeProviderTags(PROVIDER_MAP.ollama!);
    expect(text).toContain('local');
    expect(text).toContain('tools');
  });

  it('respects CARINA_FREE_PROVIDERS operator list', () => {
    process.env.CARINA_FREE_PROVIDERS = 'groq,ollama';
    expect(isOperatorFreeProvider('groq')).toBe(true);
    expect(isOperatorFreeProvider('openai')).toBe(false);
    delete process.env.CARINA_FREE_PROVIDERS;
  });

  it('assigns speed from fallback priority when not overridden', () => {
    const tags = buildRoutingTags({
      name: 'test',
      fallbackPriority: 1,
      capabilities: { chat: true, vision: false, streaming: true, tools: true },
      usdPerToken: 0.001,
    });
    expect(tags.speed).toBe('fast');
  });
});
