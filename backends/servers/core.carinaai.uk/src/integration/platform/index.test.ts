import { describe, expect, it, vi, afterEach } from 'vitest';

describe('platform integration gating', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('requires CARINA_PLATFORM_TOOLS and per-integration flags', async () => {
    const { isPlatformIntegrationEnabled, platformToolsEnabled } = await import('./index.js');
    expect(platformToolsEnabled()).toBe(false);
    vi.stubEnv('CARINA_PLATFORM_TOOLS', 'true');
    expect(platformToolsEnabled()).toBe(true);
    expect(isPlatformIntegrationEnabled('apple-notes')).toBe(false);
    vi.stubEnv('CARINA_APPLE_NOTES_ENABLED', 'true');
    expect(isPlatformIntegrationEnabled('apple-notes')).toBe(process.platform === 'darwin');
  });
});
