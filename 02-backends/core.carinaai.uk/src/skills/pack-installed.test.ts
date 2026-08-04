import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { tmpHome } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodePath = require('node:path') as typeof import('path');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeOs = require('node:os') as typeof import('os');
  return { tmpHome: nodePath.join(nodeOs.tmpdir(), `carina-user-pack-${process.pid}`) };
});

vi.mock('../config/paths.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config/paths.js')>();
  return {
    ...actual,
    CARINA_HOME: tmpHome,
    CARINA_PACKS_DIR: path.join(tmpHome, 'packs'),
    packDir: (name: string) => path.join(tmpHome, 'packs', name),
  };
});

describe('user-installed pack loading', () => {
  beforeEach(async () => {
    vi.resetModules();
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  afterEach(async () => {
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it('resolvePack loads hello-pack from ~/.carina/packs with skills.json', async () => {
    const packDir = path.join(tmpHome, 'packs', 'hello-pack');
    await fs.mkdir(path.join(packDir, 'prompts'), { recursive: true });
    await fs.writeFile(
      path.join(packDir, 'pack.json'),
      JSON.stringify({
        name: 'hello-pack',
        version: '0.1.0',
        description: 'Hello pack',
        author: 'Test',
        skillCount: 1,
        optional: true,
      }),
    );
    await fs.writeFile(
      path.join(packDir, 'skills.json'),
      JSON.stringify([
        {
          name: 'domain-greeting',
          description: 'Greet the user',
          trigger: ['hello'],
          steps: 'Say hello warmly.',
          toolsUsed: [],
        },
      ]),
    );
    await fs.writeFile(
      path.join(packDir, 'prompts', 'system.txt'),
      'Demo hello-pack suffix.',
    );

    const { clearPackResolverCacheForTests, resolvePack } = await import('./pack-resolver.js');
    clearPackResolverCacheForTests();
    const pack = await resolvePack('hello-pack');
    expect(pack.manifest.name).toBe('hello-pack');
    expect(pack.skills).toHaveLength(1);
    expect(pack.skills[0]?.name).toBe('domain-greeting');
    expect(pack.systemSuffix).toContain('hello-pack');
  });
});
