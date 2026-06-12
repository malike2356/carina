import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  debugProviderRoutingEnabled,
  maybeDebugProxyBaseUrl,
} from './provider-proxy-routing.js';

describe('provider proxy routing', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is off by default', () => {
    expect(debugProviderRoutingEnabled()).toBe(false);
    expect(maybeDebugProxyBaseUrl('openai', 'https://api.openai.com/v1')).toBe('https://api.openai.com/v1');
  });

  it('wraps base URL when routing enabled', () => {
    vi.stubEnv('CARINA_DEBUG_PROXY_ROUTING', 'true');
    vi.stubEnv('CARINA_DEBUG_PROXY_PORT', '19229');
    const wrapped = maybeDebugProxyBaseUrl('openai', 'https://api.openai.com/v1');
    expect(wrapped).toBe('http://127.0.0.1:19229/https://api.openai.com/v1');
  });

  it('respects provider filter', () => {
    vi.stubEnv('CARINA_DEBUG_PROXY_ROUTING', 'true');
    vi.stubEnv('CARINA_DEBUG_PROXY_PROVIDERS', 'anthropic');
    const openai = maybeDebugProxyBaseUrl('openai', 'https://api.openai.com/v1');
    const anthropic = maybeDebugProxyBaseUrl('anthropic', 'https://api.anthropic.com/v1');
    expect(openai).toBe('https://api.openai.com/v1');
    expect(anthropic).toContain('127.0.0.1');
  });
});
