import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { PROVIDER_DEFINITIONS, PROVIDER_MAP } from './provider-registry.js';
import {
  buildCopilotSelection,
  freeCopilotProviderOrder,
  mergeFallbackOrder,
  resolveInitialActiveProvider,
} from './provider-routing.js';

describe('provider-routing', () => {
  const originalFree = process.env.CARINA_FREE_PROVIDERS;

  beforeEach(() => {
    delete process.env.CARINA_FREE_PROVIDERS;
  });

  afterEach(() => {
    if (originalFree === undefined) delete process.env.CARINA_FREE_PROVIDERS;
    else process.env.CARINA_FREE_PROVIDERS = originalFree;
  });

  it('prefers local providers before cloud fallbacks', () => {
    const order = freeCopilotProviderOrder(
      ['deepseek', 'ollama', 'lmstudio', 'vllm'],
      PROVIDER_DEFINITIONS,
    );
    expect(order.indexOf('ollama')).toBeLessThan(order.indexOf('deepseek'));
    expect(order.indexOf('lmstudio')).toBeLessThan(order.indexOf('deepseek'));
    expect(order.indexOf('vllm')).toBeLessThan(order.indexOf('deepseek'));
  });

  it('honours operator-marked free providers before cheapest paid', () => {
    process.env.CARINA_FREE_PROVIDERS = 'groq';
    const order = freeCopilotProviderOrder(['deepseek', 'groq'], PROVIDER_DEFINITIONS);
    expect(order.indexOf('groq')).toBeLessThan(order.indexOf('deepseek'));
  });

  it('returns empty selection when nothing configured', () => {
    const selection = buildCopilotSelection([], PROVIDER_DEFINITIONS);
    expect(selection.primary).toBeNull();
    expect(selection.order).toEqual([]);
  });

  it('merges active provider to front of fallback order', () => {
    expect(mergeFallbackOrder('groq', ['deepseek', 'groq', 'openai'])).toEqual([
      'groq',
      'deepseek',
      'openai',
    ]);
  });

  it('resolveInitialActiveProvider honours DEFAULT_PROVIDER when configured', () => {
    const result = resolveInitialActiveProvider({
      configuredNames: ['deepseek', 'openai'],
      definitions: PROVIDER_DEFINITIONS,
      preferred: 'openai',
    });
    expect(result.active).toBe('openai');
    expect(result.preset).toBeUndefined();
  });

  it('resolveInitialActiveProvider skips missing preferred and picks first paid provider', () => {
    const result = resolveInitialActiveProvider({
      configuredNames: ['deepseek', 'github-copilot'],
      definitions: PROVIDER_DEFINITIONS,
      preferred: 'anthropic',
    });
    expect(result.active).toBe('deepseek');
  });

  it('resolveInitialActiveProvider falls back to github-copilot when only free provider', () => {
    const result = resolveInitialActiveProvider({
      configuredNames: ['github-copilot'],
      definitions: PROVIDER_DEFINITIONS,
    });
    expect(result.active).toBe('github-copilot');
    expect(result.preset).toBe('free-copilot');
  });

  it('resolveInitialActiveProvider returns null when nothing configured', () => {
    const result = resolveInitialActiveProvider({
      configuredNames: [],
      definitions: PROVIDER_DEFINITIONS,
    });
    expect(result.active).toBeNull();
  });

  it('includes vllm in registry as local provider', () => {
    expect(PROVIDER_MAP.vllm?.local).toBe(true);
    expect(PROVIDER_MAP.vllm?.tags.cost).toBe('local');
  });

  it('includes expanded catalog providers from Phase 1', () => {
    for (const name of ['litellm', 'sglang', 'vertex', 'cloudflare-ai-gateway', 'byteplus', 'tencent', 'volcengine', 'bedrock-mantle']) {
      expect(PROVIDER_MAP[name]).toBeDefined();
    }
    expect(PROVIDER_MAP.voyage?.status).toBe('active');
    expect(PROVIDER_MAP.voyage?.embeddingOnly).toBe(true);
    expect(PROVIDER_MAP.voyage?.capabilities.embeddings).toBe(true);
    expect(PROVIDER_MAP['github-copilot']?.status).toBe('external-cli');
  });
});
