import { describe, expect, it } from 'vitest';
import {
  KNOWN_LLM_PROVIDERS,
  PROVIDER_DEFINITIONS,
  PROVIDER_MAP,
  fallbackOrderNames,
  isProviderConfigured,
  providerApiKey,
  providerBaseUrl,
  providerModel,
} from './provider-registry.js';

describe('provider-registry', () => {
  it('registers at least 23 providers', () => {
    expect(KNOWN_LLM_PROVIDERS.length).toBeGreaterThanOrEqual(23);
  });

  it('includes nvidia NIM provider', () => {
    expect(PROVIDER_MAP.nvidia).toBeDefined();
    expect(PROVIDER_MAP.nvidia.displayName).toBe('NVIDIA NIM');
    expect(PROVIDER_MAP.nvidia.baseUrl).toBe('https://integrate.api.nvidia.com/v1');
  });

  it('has unique provider names', () => {
    const names = PROVIDER_DEFINITIONS.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });

  for (const def of PROVIDER_DEFINITIONS) {
    describe(def.name, () => {
      it('exists in PROVIDER_MAP', () => {
        expect(PROVIDER_MAP[def.name]).toBe(def);
      });

      it('has api key env ending with _API_KEY', () => {
        expect(def.apiKeyEnv).toMatch(/_API_KEY$/);
      });

      it('has default model', () => {
        expect(def.defaultModel.length).toBeGreaterThan(0);
      });

      it('has capabilities', () => {
        expect(def.capabilities.chat).toBe(true);
      });

      it('resolves model from default', () => {
        const prev = process.env[def.modelEnv];
        delete process.env[def.modelEnv];
        expect(providerModel(def)).toBe(def.defaultModel);
        if (prev) process.env[def.modelEnv] = prev;
      });

      it('reports configured state without throwing', () => {
        expect(typeof isProviderConfigured(def)).toBe('boolean');
      });

      if (def.kind === 'openai' && !def.local && def.name !== 'azure') {
        it('has base URL', () => {
          expect(providerBaseUrl(def).startsWith('http')).toBe(true);
        });
      }

      if (def.local) {
        it('is local provider', () => {
          expect(def.local).toBe(true);
        });
      }
    });
  }

  it('fallback order includes deepseek first', () => {
    expect(fallbackOrderNames()[0]).toBe('deepseek');
  });

  it('providerApiKey returns string', () => {
    for (const def of PROVIDER_DEFINITIONS) {
      expect(typeof providerApiKey(def)).toBe('string');
    }
  });
});
