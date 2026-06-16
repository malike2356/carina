import { afterEach, describe, expect, it, vi } from 'vitest';
import { PROVIDER_DEFINITIONS } from './provider-registry.js';
import { parseFallbackChainEnv, resolveProviderFallbackChain } from './fallback-chain.js';
import { markProviderUnhealthy, resetProviderHealth } from './provider-health.js';

describe('provider fallback chain', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetProviderHealth();
  });

  it('parses CARINA_PROVIDER_FALLBACK env', () => {
    expect(parseFallbackChainEnv('deepseek, openai,anthropic')).toEqual([
      'deepseek',
      'openai',
      'anthropic',
    ]);
  });

  it('puts active provider first and skips unhealthy providers', () => {
    markProviderUnhealthy('deepseek', 'down');
    const chain = resolveProviderFallbackChain({
      activeProvider: 'openai',
      configuredNames: ['openai', 'deepseek', 'anthropic'],
      definitions: PROVIDER_DEFINITIONS,
      envOverride: ['deepseek', 'openai', 'anthropic'],
    });
    expect(chain[0]).toBe('openai');
    expect(chain).not.toContain('deepseek');
    expect(chain).toContain('anthropic');
  });

  it('uses registry fallback order when env override is empty', () => {
    const chain = resolveProviderFallbackChain({
      activeProvider: 'anthropic',
      configuredNames: ['deepseek', 'anthropic'],
      definitions: PROVIDER_DEFINITIONS,
      envOverride: [],
    });
    expect(chain[0]).toBe('anthropic');
    expect(chain).toContain('deepseek');
  });
});
