import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllEnvs();
});

describe('image provider registry', () => {
  it('prefers fal when FAL_KEY is set in auto mode', async () => {
    vi.stubEnv('IMAGE_GEN_PROVIDER', 'auto');
    vi.stubEnv('FAL_KEY', 'test-fal-key');
    vi.stubEnv('OPENAI_API_KEY', 'test-openai');

    const { resolveActiveImageGenProvider } = await import('./registry.js');
    expect(resolveActiveImageGenProvider()?.name).toBe('fal');
  });

  it('honors IMAGE_GEN_PROVIDER override', async () => {
    vi.stubEnv('IMAGE_GEN_PROVIDER', 'replicate');
    vi.stubEnv('FAL_KEY', 'test-fal-key');
    vi.stubEnv('REPLICATE_API_TOKEN', 'test-replicate');

    const { resolveActiveImageGenProvider } = await import('./registry.js');
    expect(resolveActiveImageGenProvider()?.name).toBe('replicate');
  });

  it('returns null when forced provider is unavailable', async () => {
    vi.stubEnv('IMAGE_GEN_PROVIDER', 'fal');
    delete process.env.FAL_KEY;
    delete process.env.FAL_API_KEY;

    const { resolveActiveImageGenProvider } = await import('./registry.js');
    expect(resolveActiveImageGenProvider()).toBeNull();
  });

  it('lists builtin providers in describeImageGenSetup', async () => {
    const { describeImageGenSetup } = await import('./registry.js');
    const setup = describeImageGenSetup();
    const names = setup.providers.map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(['fal', 'openai', 'replicate', 'comfyui']));
  });
});
