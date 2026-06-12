import { describe, expect, it } from 'vitest';
import { PROVIDER_CAPABILITIES, providerDisplayName } from './provider-capabilities.js';
import { KNOWN_LLM_PROVIDERS } from '../brain/provider-registry.js';

describe('PROVIDER_CAPABILITIES', () => {
  it('covers all known providers', () => {
    expect(Object.keys(PROVIDER_CAPABILITIES).sort()).toEqual([...KNOWN_LLM_PROVIDERS].sort());
  });

  it('marks routable providers as chat capable', () => {
    for (const [name, capabilities] of Object.entries(PROVIDER_CAPABILITIES)) {
      if (name === 'voyage') {
        expect(capabilities.chat).toBe(false);
        continue;
      }
      expect(capabilities.chat).toBe(true);
    }
  });

  it('has display names for every provider', () => {
    for (const name of KNOWN_LLM_PROVIDERS) {
      expect(providerDisplayName(name)).not.toBe('');
    }
  });
});
