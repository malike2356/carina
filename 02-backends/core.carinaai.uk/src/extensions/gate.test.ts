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
  return { tmpHome: nodePath.join(nodeOs.tmpdir(), `carina-ext-gate-${process.pid}`) };
});
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE = path.resolve(__dirname, '../../templates/extension-sample');

vi.mock('../config/paths.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config/paths.js')>();
  return {
    ...actual,
    CARINA_HOME: tmpHome,
    CARINA_EXTENSIONS_DIR: path.join(tmpHome, 'extensions'),
    CARINA_EXTENSION_RESOURCES_DIR: path.join(tmpHome, 'resources', 'extensions'),
    CARINA_RESOURCES_DIR: path.join(tmpHome, 'resources'),
    extensionDir: (id: string) => path.join(tmpHome, 'extensions', id),
  };
});

describe('extension eval gate', () => {
  beforeEach(async () => {
    vi.resetModules();
    await fs.rm(tmpHome, { recursive: true, force: true });
    await fs.mkdir(path.join(tmpHome, 'extensions', 'sample-hello'), { recursive: true });
    await fs.cp(SAMPLE, path.join(tmpHome, 'extensions', 'sample-hello'), { recursive: true });
  });

  afterEach(async () => {
    delete process.env.CARINA_EVAL_GATE;
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it('skips when eval is not required and gate is off', async () => {
    process.env.CARINA_EVAL_GATE = 'off';
    const { runExtensionEvalGate } = await import('./gate.js');
    const { readExtensionManifest } = await import('./validator.js');
    const manifest = await readExtensionManifest(path.join(tmpHome, 'extensions', 'sample-hello'));
    const result = await runExtensionEvalGate(manifest);
    expect(result.passed).toBe(true);
    expect(result.blocked).toBe(false);
  });

  it('blocks when eval is required but missing', async () => {
    const { runExtensionEvalGate } = await import('./gate.js');
    const { readExtensionManifest } = await import('./validator.js');
    const bundleDir = path.join(tmpHome, 'extensions', 'sample-hello');
    await fs.rm(path.join(bundleDir, 'eval'), { recursive: true, force: true });
    const manifest = await readExtensionManifest(bundleDir);
    const required = { ...manifest, eval: { required: true, path: 'eval/eval.json' } };
    const result = await runExtensionEvalGate(required, { mode: 'require' });
    expect(result.blocked).toBe(true);
  });

  it('runs offline eval when definition exists', async () => {
    process.env.CARINA_EVAL_GATE = 'require';
    const { runExtensionEvalGate } = await import('./gate.js');
    const { readExtensionManifest } = await import('./validator.js');
    const manifest = await readExtensionManifest(path.join(tmpHome, 'extensions', 'sample-hello'));
    const result = await runExtensionEvalGate(manifest, { mode: 'require', passes: 1 });
    expect(result.blocked).toBe(false);
    expect(result.passed).toBe(true);
  });
});
