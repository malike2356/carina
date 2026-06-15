import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('extension hooks loader', () => {
  let tmpHome: string;

  beforeEach(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-hooks-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.stubEnv('CARINA_EXTENSIONS_DIR', path.join(tmpHome, 'extensions'));
    vi.stubEnv('CARINA_EXTENSIONS_ENABLED', 'true');
    vi.resetModules();
  });

  afterEach(async () => {
    const mod = await import('./hooks-loader.js');
    mod.resetExtensionHooksForTests();
    await fs.rm(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('loads and runs hook handlers from a bundle', async () => {
    const extDir = path.join(tmpHome, 'extensions', 'hook-demo');
    await fs.mkdir(path.join(extDir, 'hooks'), { recursive: true });
    await fs.writeFile(path.join(extDir, 'extension.json'), JSON.stringify({
      manifestVersion: 1,
      id: 'hook-demo',
      version: '1.0.0',
      name: 'Hook Demo',
      author: 'Test',
      description: 'Demo',
      capabilities: ['hooks'],
      entryPoints: { hooks: 'hooks.json' },
    }));
    await fs.writeFile(path.join(extDir, 'hooks.json'), JSON.stringify({
      hooks: [{ hook: 'before-turn', module: 'hooks/before-turn.js' }],
    }));
    await fs.writeFile(path.join(extDir, 'hooks', 'before-turn.js'), `
      export default async function handler(payload) {
        return { saw: payload?.text ?? '' };
      }
    `);
    await fs.writeFile(path.join(tmpHome, 'extension-store.json'), JSON.stringify({
      extensions: [{ id: 'hook-demo', version: '1.0.0', name: 'Hook Demo', status: 'enabled', installed_at: new Date().toISOString() }],
    }));

    const { loadExtensionHooks, runExtensionHooks } = await import('./hooks-loader.js');
    const loaded = await loadExtensionHooks('hook-demo');
    expect(loaded).toBe(1);
    const results = await runExtensionHooks('before-turn', { text: 'hello' });
    expect(results[0]).toEqual({ saw: 'hello' });
  });
});
