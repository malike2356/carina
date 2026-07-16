import { describe, expect, it } from 'vitest';
import { validatePackDir } from './validate.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('validatePackDir', () => {
  it('rejects pack without markdown', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-pack-'));
    await fs.writeFile(
      path.join(tmp, 'pack.json'),
      JSON.stringify({ name: 't', version: '1', description: 'd', author: 'a', skillCount: 0 }),
    );
    await expect(validatePackDir(tmp)).rejects.toThrow(/at least one/);
    await fs.rm(tmp, { recursive: true });
  });

  it('accepts valid pack layout', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-pack-'));
    await fs.writeFile(
      path.join(tmp, 'pack.json'),
      JSON.stringify({ name: 't', version: '1', description: 'd', author: 'a', skillCount: 1 }),
    );
    await fs.mkdir(path.join(tmp, 'knowledge'), { recursive: true });
    await fs.writeFile(path.join(tmp, 'knowledge', 'a.md'), '# Hello\n\nSafe content.');
    const manifest = await validatePackDir(tmp);
    expect(manifest.name).toBe('t');
    await fs.rm(tmp, { recursive: true });
  });
});
