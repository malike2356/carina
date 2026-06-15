import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../brain/tenant-provider-keys.js', () => ({
  getTenantProvider: vi.fn(),
}));

vi.mock('../brain/provider-registry.js', () => ({
  isProviderConfigured: vi.fn(),
  PROVIDER_MAP: { anthropic: { id: 'anthropic' } } as Record<string, unknown>,
}));

vi.mock('../config/index.js', () => ({
  config: {
    carinaOps: {
      managedWorkbenchEnabled: false,
    },
  },
}));

import { getTenantProvider } from '../brain/tenant-provider-keys.js';
import { isProviderConfigured } from '../brain/provider-registry.js';
import { config } from '../config/index.js';
import {
  getWorkbenchInferenceCapabilities,
  isManagedWorkbenchEnabled,
  resolveWorkbenchInferenceMode,
} from './workbench-inference.js';

describe('workbench-inference', () => {
  beforeEach(() => {
    config.carinaOps.managedWorkbenchEnabled = false;
    vi.mocked(getTenantProvider).mockResolvedValue(null);
    vi.mocked(isProviderConfigured).mockReturnValue(false);
  });

  it('prefers BYOK when vault key exists', async () => {
    vi.mocked(getTenantProvider).mockResolvedValueOnce({ provider: 'anthropic', apiKey: 'sk-test' });
    await expect(resolveWorkbenchInferenceMode('tenant-1', 'anthropic')).resolves.toBe('byok');
  });

  it('falls back to managed when enabled and platform key exists', async () => {
    config.carinaOps.managedWorkbenchEnabled = true;
    vi.mocked(isProviderConfigured).mockReturnValue(true);
    await expect(resolveWorkbenchInferenceMode('tenant-1', 'anthropic')).resolves.toBe('managed');
  });

  it('returns null when neither path is available', async () => {
    await expect(resolveWorkbenchInferenceMode('tenant-1', 'anthropic')).resolves.toBeNull();
  });

  it('reports capabilities for UI and estimate routing', async () => {
    config.carinaOps.managedWorkbenchEnabled = true;
    vi.mocked(isProviderConfigured).mockReturnValue(true);
    const caps = await getWorkbenchInferenceCapabilities('tenant-1', 'anthropic');
    expect(caps).toEqual({
      byok: false,
      managed: true,
      inferenceMode: 'managed',
    });
  });

  it('reads managed flag from config', () => {
    config.carinaOps.managedWorkbenchEnabled = true;
    expect(isManagedWorkbenchEnabled()).toBe(true);
  });
});
