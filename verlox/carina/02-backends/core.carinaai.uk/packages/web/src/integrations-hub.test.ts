import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchConnectorCatalog,
  getInstallHandoffUrl,
  getStudioDeepLink,
} from './integrations-hub.js';

vi.mock('./agent-studio-playbook-bridge.js', () => ({
  getStudioHandoffUrl: vi.fn(async (path: string) => `https://studio.keprix.example.com${path}?token=abc`),
}));

describe('integrations-hub', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
    vi.restoreAllMocks();
  });

  it('returns stub catalog when INTEGRATIONS_CATALOG_STUB=1', async () => {
    process.env.INTEGRATIONS_CATALOG_STUB = '1';
    const result = await fetchConnectorCatalog('tenant-1');
    expect(result.stub).toBe(true);
    expect(result.connectors.length).toBeGreaterThanOrEqual(1);
    expect(result.connectors.some((row) => row.id === 'notion')).toBe(true);
  });

  it('builds install handoff url with keprix origin', async () => {
    process.env.INTEGRATIONS_CATALOG_STUB = '1';
    const url = await getInstallHandoffUrl('github', {
      subject: 'user@example.com',
      tenantId: 'tenant-1',
      carinaUserId: 'user-1',
    });
    expect(url).toContain('https://studio.keprix.example.com');
    expect(url).toContain('connector=github');
  });

  it('builds studio deep link with connector query param', async () => {
    process.env.INTEGRATIONS_CATALOG_STUB = '1';
    const url = await getStudioDeepLink('notion', {
      subject: 'user@example.com',
      tenantId: 'tenant-1',
      carinaUserId: 'user-1',
    });
    expect(url).toContain('/playbooks/studio/new?connector=notion');
  });
});
