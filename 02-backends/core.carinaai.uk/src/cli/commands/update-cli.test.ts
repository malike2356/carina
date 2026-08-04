import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { resolvePackageJsonPath } from './update-cli.js';

describe('update-cli package.json resolution', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('finds package.json from the source layout', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-update-source-'));
    tempDirs.push(root);
    const here = path.join(root, 'src', 'cli', 'commands');
    await fs.mkdir(here, { recursive: true });
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ version: '9.9.9' }));

    expect(resolvePackageJsonPath(here)).toBe(path.join(root, 'package.json'));
  });

  it('finds package.json from the dist layout', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-update-dist-'));
    tempDirs.push(root);
    const here = path.join(root, 'dist', 'src', 'cli', 'commands');
    await fs.mkdir(here, { recursive: true });
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ version: '9.9.9' }));

    expect(resolvePackageJsonPath(here)).toBe(path.join(root, 'package.json'));
  });
});
