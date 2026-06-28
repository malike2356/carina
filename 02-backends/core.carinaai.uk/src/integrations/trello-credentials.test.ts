import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('trello-credentials', () => {
  let dataDir = '';

  beforeEach(() => {
    vi.resetModules();
    dataDir = mkdtempSync(join(tmpdir(), 'carina-trello-cred-'));
    process.env.CARINA_HOME = dataDir;
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
    delete process.env.CARINA_HOME;
    delete process.env.TRELLO_API_KEY;
    delete process.env.TRELLO_TOKEN;
  });

  it('reports unconfigured when no store or env', async () => {
    const mod = await import('./trello-credentials.js');
    expect(await mod.isTrelloConfigured()).toBe(false);
    expect(await mod.getTrelloSettingsStatus()).toEqual({ configured: false, source: 'none' });
  });

  it('saves and loads encrypted credentials', async () => {
    const mod = await import('./trello-credentials.js');
    await mod.saveTrelloCredentials({ apiKey: 'test-key', token: 'test-token' });
    const status = await mod.getTrelloSettingsStatus();
    expect(status.configured).toBe(true);
    expect(status.source).toBe('stored');
    expect(status.apiKeyMask).toBe('test...ey');
    expect(await mod.isTrelloConfigured()).toBe(true);
    const resolved = await mod.resolveTrelloCredentials();
    expect(resolved).toEqual({ apiKey: 'test-key', token: 'test-token' });
  });

  it('scopes credentials per tenant', async () => {
    const mod = await import('./trello-credentials.js');
    await mod.runWithTrelloTenantScopeAsync('tenant-a', async () => {
      await mod.saveTrelloCredentials({ apiKey: 'key-a', token: 'token-a' });
    });
    await mod.runWithTrelloTenantScopeAsync('tenant-b', async () => {
      await mod.saveTrelloCredentials({ apiKey: 'key-b', token: 'token-b' });
    });

    const credA = await mod.runWithTrelloTenantScopeAsync('tenant-a', () => mod.resolveTrelloCredentials());
    const credB = await mod.runWithTrelloTenantScopeAsync('tenant-b', () => mod.resolveTrelloCredentials());
    expect(credA).toEqual({ apiKey: 'key-a', token: 'token-a' });
    expect(credB).toEqual({ apiKey: 'key-b', token: 'token-b' });
  });

  it('clears stored credentials', async () => {
    const mod = await import('./trello-credentials.js');
    await mod.saveTrelloCredentials({ apiKey: 'test-key', token: 'test-token' });
    await mod.clearTrelloCredentials();
    expect(await mod.isTrelloConfigured()).toBe(false);
  });
});
