import { afterEach, describe, expect, it, vi } from 'vitest';
import { PROVIDER_DEFINITIONS } from './provider-registry.js';
import {
  isLlmRotationEnabled,
  parseFallbackChainEnv,
  parseRotationProvidersEnv,
  resolveProviderFallbackChain,
} from './fallback-chain.js';
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

  it('prefers CARINA_LLM_ROTATION_PROVIDERS over legacy fallback', () => {
    vi.stubEnv('CARINA_LLM_ROTATION_PROVIDERS', 'deepseek,anthropic');
    vi.stubEnv('CARINA_PROVIDER_FALLBACK', 'openai');
    expect(parseRotationProvidersEnv()).toEqual(['deepseek', 'anthropic']);
  });

  it('falls back to CARINA_PROVIDER_FALLBACK when rotation list empty', () => {
    vi.stubEnv('CARINA_LLM_ROTATION_PROVIDERS', '');
    vi.stubEnv('CARINA_PROVIDER_FALLBACK', 'openai,deepseek');
    expect(parseRotationProvidersEnv()).toEqual(['openai', 'deepseek']);
  });

  it('defaults rotation to enabled', () => {
    expect(isLlmRotationEnabled()).toBe(true);
    expect(isLlmRotationEnabled('')).toBe(true);
    expect(isLlmRotationEnabled('true')).toBe(true);
  });

  it('treats false/off/0/no as rotation disabled', () => {
    expect(isLlmRotationEnabled('false')).toBe(false);
    expect(isLlmRotationEnabled('off')).toBe(false);
    expect(isLlmRotationEnabled('0')).toBe(false);
    expect(isLlmRotationEnabled('no')).toBe(false);
  });

  it('locks to active provider only when rotation is disabled', () => {
    const chain = resolveProviderFallbackChain({
      activeProvider: 'deepseek',
      configuredNames: ['openai', 'deepseek', 'anthropic'],
      definitions: PROVIDER_DEFINITIONS,
      envOverride: ['openai', 'anthropic', 'deepseek'],
      rotationEnabled: false,
    });
    expect(chain).toEqual(['deepseek']);
  });

  it('returns empty when rotation off and active provider unavailable', () => {
    markProviderUnhealthy('deepseek', 'down');
    const chain = resolveProviderFallbackChain({
      activeProvider: 'deepseek',
      configuredNames: ['deepseek', 'openai'],
      definitions: PROVIDER_DEFINITIONS,
      rotationEnabled: false,
    });
    expect(chain).toEqual([]);
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

  it('filters to rotation allowlist when enabled', () => {
    const chain = resolveProviderFallbackChain({
      activeProvider: 'deepseek',
      configuredNames: ['deepseek', 'openai', 'anthropic'],
      definitions: PROVIDER_DEFINITIONS,
      envOverride: ['deepseek', 'anthropic'],
      rotationEnabled: true,
    });
    expect(chain).toEqual(['deepseek', 'anthropic']);
  });
});
