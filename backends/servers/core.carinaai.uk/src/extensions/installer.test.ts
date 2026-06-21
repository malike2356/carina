import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE = path.resolve(__dirname, '../../templates/extension-sample');

const { tmpHome } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodePath = require('node:path') as typeof import('path');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeOs = require('node:os') as typeof import('os');
  return { tmpHome: nodePath.join(nodeOs.tmpdir(), `carina-ext-install-${process.pid}`) };
});

vi.mock('../config/paths.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config/paths.js')>();
  return {
    ...actual,
    CARINA_HOME: tmpHome,
    CARINA_EXTENSIONS_DIR: path.join(tmpHome, 'extensions'),
    extensionDir: (id: string) => path.join(tmpHome, 'extensions', id),
  };
});

describe('extension installer', () => {
  let archivePath: string;

  beforeEach(async () => {
    vi.resetModules();
    await fs.rm(tmpHome, { recursive: true, force: true });
    process.env.CARINA_EVAL_GATE = 'bypass';
    archivePath = path.join(tmpHome, 'sample-hello.tgz');
    await fs.mkdir(tmpHome, { recursive: true });
    await execFileAsync('tar', ['-czf', archivePath, '-C', SAMPLE, '.']);
  });

  afterEach(async () => {
    delete process.env.CARINA_EVAL_GATE;
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it('installs from tar.gz archive', async () => {
    const { installExtensionBundle } = await import('./installer.js');
    const result = await installExtensionBundle({ source: archivePath });
    expect(result.id).toBe('sample-hello');
    const manifest = await fs.readFile(
      path.join(result.path, 'extension.json'),
      'utf-8',
    );
    expect(manifest).toContain('sample-hello');
  });
});
