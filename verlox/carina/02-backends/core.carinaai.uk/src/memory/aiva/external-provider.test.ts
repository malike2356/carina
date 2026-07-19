import { describe, expect, it } from 'vitest';

describe('aiva external memory provider', () => {
  it('defaults to off', async () => {
    delete process.env.AIVA_EXTERNAL_MEMORY;
    const { resolveAivaExternalMemoryProvider, describeExternalMemoryForStatus } =
      await import('./external-provider.js');
    expect(resolveAivaExternalMemoryProvider()).toBe('off');
    expect(describeExternalMemoryForStatus()).toMatch(/off/);
  });

  it('accepts mem0 and honcho', async () => {
    process.env.AIVA_EXTERNAL_MEMORY = 'mem0';
    const { resolveAivaExternalMemoryProvider } = await import('./external-provider.js');
    expect(resolveAivaExternalMemoryProvider()).toBe('mem0');
    process.env.AIVA_EXTERNAL_MEMORY = 'honcho';
    expect(resolveAivaExternalMemoryProvider()).toBe('honcho');
    delete process.env.AIVA_EXTERNAL_MEMORY;
  });
});
