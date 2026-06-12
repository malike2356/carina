import { describe, expect, it, beforeEach } from 'vitest';
import {
  getProviderHealth,
  isProviderAvailable,
  markProviderHealthy,
  markProviderUnhealthy,
  resetProviderHealth,
} from './provider-health.js';

describe('provider-health', () => {
  beforeEach(() => {
    resetProviderHealth();
  });

  it('treats unknown providers as available', () => {
    expect(isProviderAvailable('ollama')).toBe(true);
    expect(getProviderHealth('ollama')).toBe('unknown');
  });

  it('skips unhealthy providers in availability checks', () => {
    markProviderUnhealthy('ollama', 'connection refused');
    expect(isProviderAvailable('ollama')).toBe(false);
    expect(getProviderHealth('ollama')).toBe('unhealthy');
  });

  it('recovers provider after healthy mark', () => {
    markProviderUnhealthy('lmstudio');
    markProviderHealthy('lmstudio');
    expect(isProviderAvailable('lmstudio')).toBe(true);
    expect(getProviderHealth('lmstudio')).toBe('healthy');
  });
});
