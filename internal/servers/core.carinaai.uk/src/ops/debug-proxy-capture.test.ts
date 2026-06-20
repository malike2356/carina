import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('debug-proxy-capture', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-cap-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('records and purges captures', async () => {
    vi.stubEnv('CARINA_DEBUG_PROXY_CAPTURE', 'true');
    const mod = await import('./debug-proxy-capture.js');
    expect(mod.debugCaptureEnabled()).toBe(true);
    const entry = mod.recordDebugCapture({
      direction: 'request',
      method: 'POST',
      url: 'https://api.openai.com/v1/chat/completions',
      bodyPreview: '{"model":"gpt-4"}',
      bytes: 20,
    });
    expect(entry).not.toBeNull();
    expect(mod.inferProviderFromUrl(entry!.url)).toBe('openai');
    expect(mod.listProxiedProviders()).toContain('openai');
    expect(mod.getDebugCapture(entry!.id)?.id).toBe(entry!.id);
    expect(mod.purgeDebugCaptures()).toBe(1);
  });

  it('filters captures by provider list', async () => {
    vi.stubEnv('CARINA_DEBUG_PROXY_PROVIDERS', 'anthropic');
    const mod = await import('./debug-proxy-capture.js');
    const skipped = mod.recordDebugCapture({
      direction: 'request',
      method: 'POST',
      url: 'https://api.openai.com/v1/chat/completions',
      bodyPreview: '{}',
      bytes: 2,
    });
    expect(skipped).toBeNull();
    const kept = mod.recordDebugCapture({
      direction: 'request',
      method: 'POST',
      url: 'https://api.anthropic.com/v1/messages',
      bodyPreview: '{}',
      bytes: 2,
    });
    expect(kept?.provider).toBe('anthropic');
  });

  it('redacts bearer tokens in previews', async () => {
    const { redactBodyPreview } = await import('./debug-proxy-capture.js');
    const out = redactBodyPreview('Authorization: Bearer sk-secret-key-12345');
    expect(out).not.toContain('sk-secret');
    expect(out).toContain('<redacted>');
  });
});
