import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/settings-store.js', () => ({
  readDomainSettings: vi.fn(async () => ({})),
  writeSetting: vi.fn(async (opts: { envVar?: string; value: string }) => {
    if (opts.envVar) process.env[opts.envVar] = opts.value;
    return { ok: true };
  }),
}));

vi.mock('../cli/config/loader.js', () => ({
  appendEnvValue: vi.fn(async () => undefined),
}));

vi.mock('../brain/llm.js', () => ({
  llm: {
    current: () => ({ name: 'deepseek' }),
    isProviderConfigured: () => true,
    use: vi.fn(),
  },
}));

import { readDomainSettings, writeSetting } from '../config/settings-store.js';
import {
  getLlmRotationPlatformStatus,
  saveLlmRotationPlatformConfig,
} from './llm-rotation-platform.js';

describe('llm-rotation-platform', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('reports rotation off and locked chain', async () => {
    vi.stubEnv('CARINA_LLM_ROTATION_ENABLED', 'false');
    vi.stubEnv('DEFAULT_PROVIDER', 'deepseek');
    vi.stubEnv('DEEPSEEK_API_KEY', 'sk-test-key-123456');
    vi.stubEnv('DEEPSEEK_MODEL', 'deepseek-chat');

    const status = await getLlmRotationPlatformStatus();
    expect(status.enabled).toBe(false);
    expect(status.defaultProvider).toBe('deepseek');
    expect(status.chain).toEqual(['deepseek']);
  });

  it('saves rotation allowlist and enables rotation', async () => {
    vi.stubEnv('DEEPSEEK_API_KEY', 'sk-test-key-123456');
    const result = await saveLlmRotationPlatformConfig({
      enabled: true,
      providers: ['deepseek', 'anthropic'],
      defaultProvider: 'deepseek',
      model: 'deepseek-chat',
    });
    expect(result.ok).toBe(true);
    expect(writeSetting).toHaveBeenCalled();
    expect(process.env.CARINA_LLM_ROTATION_ENABLED).toBe('true');
    expect(process.env.CARINA_LLM_ROTATION_PROVIDERS).toBe('deepseek,anthropic');
    expect(process.env.DEFAULT_PROVIDER).toBe('deepseek');
    expect(process.env.DEEPSEEK_MODEL).toBe('deepseek-chat');
  });

  it('rejects unknown providers', async () => {
    const result = await saveLlmRotationPlatformConfig({
      providers: ['not-a-real-provider'],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Unknown providers/);
  });

  it('applies DB settings over env when present', async () => {
    vi.mocked(readDomainSettings).mockResolvedValueOnce({
      CARINA_LLM_ROTATION_ENABLED: 'false',
      DEFAULT_PROVIDER: 'deepseek',
      DEEPSEEK_MODEL: 'deepseek-chat',
    });
    vi.stubEnv('CARINA_LLM_ROTATION_ENABLED', 'true');
    const status = await getLlmRotationPlatformStatus();
    expect(status.enabled).toBe(false);
    expect(status.source).toMatch(/carina_settings|mixed/);
  });

  it('includes curated models for the default provider', async () => {
    vi.stubEnv('CARINA_LLM_ROTATION_ENABLED', 'false');
    vi.stubEnv('DEFAULT_PROVIDER', 'deepseek');
    vi.stubEnv('DEEPSEEK_API_KEY', 'sk-test-key-123456');
    vi.stubEnv('DEEPSEEK_MODEL', 'deepseek-chat');

    const status = await getLlmRotationPlatformStatus();
    expect(status.modelsByProvider.deepseek).toContain('deepseek-chat');
    expect(status.knownProviders.find((p) => p.name === 'deepseek')?.models).toContain('deepseek-chat');
  });
});
