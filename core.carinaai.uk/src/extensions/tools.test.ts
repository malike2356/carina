import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

const tmpHome = path.join(os.tmpdir(), `carina-ext-tools-${process.pid}`);

vi.mock('../config/paths.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config/paths.js')>();
  return {
    ...actual,
    CARINA_HOME: tmpHome,
    CARINA_EXTENSIONS_DIR: path.join(tmpHome, 'extensions'),
    extensionDir: (id: string) => path.join(tmpHome, 'extensions', id),
  };
});

describe('extension tools', () => {
  beforeEach(async () => {
    vi.resetModules();
    await fs.rm(tmpHome, { recursive: true, force: true });
    process.env.CARINA_EXTENSIONS_ENABLED = 'true';
  });

  afterEach(async () => {
    delete process.env.CARINA_EXTENSIONS_ENABLED;
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it('registers http tools from JSON into the shared registry', async () => {
    const bundleDir = path.join(tmpHome, 'extensions', 'demo-http');
    await fs.mkdir(path.join(bundleDir, 'tools'), { recursive: true });
    await fs.writeFile(path.join(bundleDir, 'extension.json'), JSON.stringify({
      manifestVersion: 1,
      id: 'demo-http',
      version: '0.1.0',
      name: 'Demo HTTP',
      author: 'Test',
      description: 'demo',
      capabilities: ['tools'],
      entryPoints: { tools: 'tools/tools.json' },
    }));
    await fs.writeFile(path.join(bundleDir, 'tools/tools.json'), JSON.stringify({
      tools: [{
        name: 'ping',
        description: 'Ping hook',
        integration: 'http',
        url: 'https://example.com/hook',
        parameters: { type: 'object', properties: {} },
      }],
    }));

    const { registerExtensionToolsFromBundle } = await import('./tools.js');
    const { registry } = await import('../tools/registry.js');
    const count = await registerExtensionToolsFromBundle('demo-http');
    expect(count).toBe(1);
    expect(registry.get('ext_demo_http_ping')).toBeDefined();
  });

  it('does not register tools when extensions runtime is disabled', async () => {
    process.env.CARINA_EXTENSIONS_ENABLED = 'false';
    const { registerEnabledExtensionTools } = await import('./tools.js');
    const count = await registerEnabledExtensionTools();
    expect(count).toBe(0);
  });
});
