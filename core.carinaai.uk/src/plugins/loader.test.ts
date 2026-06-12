import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import copilotPlugin from '../../plugins/providers/github-copilot.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('provider plugin loader', () => {
  it('discovers github-copilot plugin file on disk', async () => {
    const { listProviderPluginFiles } = await import('./loader.js');
    const files = listProviderPluginFiles(projectRoot);
    expect(files).toContain('github-copilot.ts');
  });

  it('registers github-copilot as an active routable provider', async () => {
    const { registerPluginProviders, PROVIDER_MAP } = await import('../brain/provider-registry.js');
    const before = PROVIDER_MAP['github-copilot'];
    const added = registerPluginProviders(copilotPlugin.providerDefinitions);
    if (!before) {
      expect(added).toContain('github-copilot');
    }
    expect(PROVIDER_MAP['github-copilot']?.status).toBe('active');
    expect(PROVIDER_MAP['github-copilot']?.apiKeyEnv).toBe('GITHUB_TOKEN');
  });
});
