import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('extension rule pack loader', () => {
  let tmpHome: string;

  beforeEach(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-rule-packs-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.stubEnv('CARINA_EXTENSIONS_DIR', path.join(tmpHome, 'extensions'));
    vi.stubEnv('CARINA_EXTENSIONS_ENABLED', 'true');
    vi.resetModules();
  });

  afterEach(async () => {
    const { clearExtensionRulePacks } = await import('../domain-rules/registry.js');
    clearExtensionRulePacks();
    await fs.rm(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('discovers rules.json from an enabled extension bundle', async () => {
    const extDir = path.join(tmpHome, 'extensions', 'demo-rules');
    await fs.mkdir(extDir, { recursive: true });
    await fs.writeFile(path.join(extDir, 'rules.json'), JSON.stringify({
      id: 'demo-custom',
      label: 'Demo custom',
      tools: ['ext_demo_rules_ping'],
      rules: ['Use the ping tool for health checks.'],
    }));
    await fs.writeFile(path.join(tmpHome, 'extension-store.json'), JSON.stringify({
      extensions: [{
        id: 'demo-rules',
        version: '1.0.0',
        name: 'Demo Rules',
        status: 'enabled',
        installed_at: new Date().toISOString(),
      }],
    }));

    const { loadEnabledExtensionRulePacks } = await import('./rule-packs-loader.js');
    const { listExtensionDomainRulePacks } = await import('../domain-rules/registry.js');
    const count = await loadEnabledExtensionRulePacks();
    expect(count).toBe(1);
    expect(listExtensionDomainRulePacks()[0]?.id).toBe('demo-custom');
  });
});
