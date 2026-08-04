import { describe, expect, it, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { searchFilesTool } from './search-files.js';

const execFileAsync = promisify(execFile);

let tmpDir: string;

async function setup(): Promise<string> {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-search-test-'));
  await fs.writeFile(path.join(tmpDir, 'alpha.ts'), 'export const alpha = 1;\n');
  await fs.writeFile(path.join(tmpDir, 'beta.ts'), 'export const beta = 2;\n');
  return tmpDir;
}

afterEach(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('search-files', () => {
  it('finds content via ripgrep when available', async () => {
    await setup();
    let hasRg = false;
    try {
      await execFileAsync('rg', ['--version']);
      hasRg = true;
    } catch {
      hasRg = false;
    }

    const result = await searchFilesTool.execute({
      pattern: 'alpha',
      path: tmpDir,
    }) as Record<string, unknown>;

    if (hasRg) {
      expect(result.engine).toBe('ripgrep');
    }
    expect(Number(result.count)).toBeGreaterThan(0);
  });

  it('blocks unsafe paths', async () => {
    const result = await searchFilesTool.execute({
      pattern: 'test',
      path: '/etc',
    }) as Record<string, unknown>;

    expect(result.error).toContain('not allowed');
  });

  it('returns error for empty pattern on content search', async () => {
    await setup();
    const result = await searchFilesTool.execute({
      pattern: '',
      path: tmpDir,
    }) as Record<string, unknown>;

    expect(result.error).toContain('pattern is required');
  });
});
