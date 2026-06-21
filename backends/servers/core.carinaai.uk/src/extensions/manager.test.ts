import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

const { tmpHome } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodePath = require('node:path') as typeof import('path');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeOs = require('node:os') as typeof import('os');
  return { tmpHome: nodePath.join(nodeOs.tmpdir(), `carina-ext-mgr-${process.pid}`) };
});
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE = path.resolve(__dirname, '../../templates/extension-sample');

vi.mock('../config/paths.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config/paths.js')>();
  return {
    ...actual,
    CARINA_HOME: tmpHome,
    CARINA_EXTENSIONS_DIR: path.join(tmpHome, 'extensions'),
    CARINA_RESOURCES_DIR: path.join(tmpHome, 'resources'),
    CARINA_EXTENSION_RESOURCES_DIR: path.join(tmpHome, 'resources', 'extensions'),
    extensionDir: (id: string) => path.join(tmpHome, 'extensions', id),
  };
});

describe('extension manager', () => {
  beforeEach(async () => {
    vi.resetModules();
    await fs.rm(tmpHome, { recursive: true, force: true });
    process.env.CARINA_EVAL_GATE = 'bypass';
  });

  afterEach(async () => {
    delete process.env.CARINA_EVAL_GATE;
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it('installs from local path and lists bundle', async () => {
    const { installExtension, listExtensions } = await import('./manager.js');
    const installed = await installExtension(SAMPLE);
    expect(installed.id).toBe('sample-hello');

    const rows = await listExtensions();
    expect(rows.some((r) => r.id === 'sample-hello' && r.status === 'installed')).toBe(true);
  });

  it('enables, disables, and removes an extension', async () => {
    const {
      installExtension,
      enableExtension,
      disableExtension,
      removeExtension,
      listExtensions,
    } = await import('./manager.js');

    await installExtension(SAMPLE);
    const enabled = await enableExtension('sample-hello', { bypassEval: true });
    expect(enabled.status).toBe('enabled');

    let rows = await listExtensions();
    expect(rows.find((r) => r.id === 'sample-hello')?.status).toBe('enabled');

    await disableExtension('sample-hello');
    rows = await listExtensions();
    expect(rows.find((r) => r.id === 'sample-hello')?.status).toBe('disabled');

    await removeExtension('sample-hello');
    rows = await listExtensions();
    expect(rows.find((r) => r.id === 'sample-hello')).toBeUndefined();
  });

  it('creates snapshot and rolls back after bundle mutation', async () => {
    const { installExtension, enableExtension, rollbackExtension } = await import('./manager.js');
    await installExtension(SAMPLE);
    await enableExtension('sample-hello', { bypassEval: true });

    const bundleDir = path.join(tmpHome, 'extensions', 'sample-hello');
    const skillPath = path.join(bundleDir, 'skills', 'hello.json');
    const original = await fs.readFile(skillPath, 'utf-8');
    await fs.writeFile(skillPath, '{"name":"mutated"}', 'utf-8');

    const restored = await rollbackExtension('sample-hello');
    expect(restored).toBeTruthy();
    expect(await fs.readFile(skillPath, 'utf-8')).toBe(original);
  });
});
