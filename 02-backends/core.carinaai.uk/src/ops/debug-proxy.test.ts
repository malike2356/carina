import { describe, expect, it } from 'vitest';
import { resolveDebugProxyUpstream } from './debug-proxy.js';

describe('debug proxy upstream resolution', () => {
  const defaultTarget = new URL('http://127.0.0.1:3000');

  it('forwards relative paths to default target', () => {
    const url = resolveDebugProxyUpstream('/api/health', defaultTarget);
    expect(url.href).toBe('http://127.0.0.1:3000/api/health');
  });

  it('passthroughs absolute provider URLs embedded in path', () => {
    const url = resolveDebugProxyUpstream(
      '/https://api.openai.com/v1/chat/completions',
      defaultTarget,
    );
    expect(url.origin).toBe('https://api.openai.com');
    expect(url.pathname).toBe('/v1/chat/completions');
  });

  it('passthroughs anthropic URLs', () => {
    const url = resolveDebugProxyUpstream(
      '/https://api.anthropic.com/v1/messages',
      defaultTarget,
    );
    expect(url.origin).toBe('https://api.anthropic.com');
    expect(url.pathname).toBe('/v1/messages');
  });
});
