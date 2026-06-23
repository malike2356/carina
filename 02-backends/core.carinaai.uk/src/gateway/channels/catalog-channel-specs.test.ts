import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

describe('catalog channel specs', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('treats IRC as a full adapter channel', async () => {
    const { buildCatalogChannelSpecs, isCatalogStubChannel } = await import('./catalog-channel-specs.js');
    const irc = buildCatalogChannelSpecs().find((spec) => spec.channel === 'irc');
    expect(irc).toBeDefined();
    expect(irc?.transport?.()).toBe('irc-live');
    expect(isCatalogStubChannel('irc')).toBe(false);
  });
});
