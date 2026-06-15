import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../config/index.js', () => ({
  config: {
    labyrinth: {
      enabled: false,
      url: '',
      apiKey: '',
      instanceId: 'test',
      instanceName: 'Test',
    },
  },
}));

describe('load-scout-package', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.LABYRINTH_ENABLED;
    delete process.env.SCOUT_ENABLED;
  });

  it('does not load @verlox/carina-scout when integration is disabled', async () => {
    const { importScoutPackage, _resetScoutPackageCache } = await import('./load-scout-package.js');
    _resetScoutPackageCache();
    const mod = await importScoutPackage();
    expect(mod).toBeNull();
  });

  it('returns install hint text', async () => {
    const { scoutInstallHint } = await import('./load-scout-package.js');
    expect(scoutInstallHint()).toContain('@verlox/carina-scout');
  });
});

describe('scout-client shim', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.LABYRINTH_ENABLED;
  });

  it('reportEvent is a no-op when scout is disabled', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { reportEvent } = await import('./scout-client.js');
    await reportEvent({
      severity: 'info',
      source: 'test',
      event_type: 'test',
      description: 'test',
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
