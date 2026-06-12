import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateExtensionBundle } from './validator.js';
import { carinaRuntimeVersion } from './version-compat.js';

const tmpRoot = path.join(os.tmpdir(), `carina-ext-val-${process.pid}`);

async function writeBundle(
  id: string,
  manifest: Record<string, unknown>,
  extra?: { skillsDir?: boolean },
): Promise<string> {
  const dir = path.join(tmpRoot, id);
  await fs.mkdir(path.join(dir, 'skills'), { recursive: true });
  if (extra?.skillsDir !== false) {
    await fs.writeFile(
      path.join(dir, 'skills', 'demo.json'),
      JSON.stringify({ name: 'demo', description: 'Demo', prompt: 'Hi' }),
    );
  }
  await fs.writeFile(path.join(dir, 'extension.json'), JSON.stringify(manifest, null, 2));
  return dir;
}

describe('validateExtensionBundle', () => {
  beforeEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('warns on catalog-only mcp capability', async () => {
    const dir = await writeBundle('mcp-demo', {
      manifestVersion: 1,
      id: 'mcp-demo',
      version: '1.0.0',
      name: 'MCP Demo',
      author: 'Test',
      description: 'Demo',
      capabilities: ['mcp'],
      entryPoints: { mcp: 'mcp.json' },
    });
    await fs.writeFile(path.join(dir, 'mcp.json'), '{}');

    const result = await validateExtensionBundle(dir, { allowHighRisk: true });
    expect(result.warnings.some((w) => w.includes('mcp'))).toBe(true);
  });

  it('rejects minCarinaVersion above running version', async () => {
    const dir = await writeBundle('future-req', {
      manifestVersion: 1,
      id: 'future-req',
      version: '1.0.0',
      name: 'Future',
      author: 'Test',
      description: 'Demo',
      capabilities: ['skills'],
      entryPoints: { skills: 'skills/' },
      minCarinaVersion: '99.0.0',
    });

    const result = await validateExtensionBundle(dir, { allowHighRisk: true });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('99.0.0'))).toBe(true);
    expect(result.errors.some((e) => e.includes(carinaRuntimeVersion()))).toBe(true);
  });

  it('accepts minCarinaVersion at or below running version', async () => {
    const running = carinaRuntimeVersion();
    const dir = await writeBundle('compat-ok', {
      manifestVersion: 1,
      id: 'compat-ok',
      version: '1.0.0',
      name: 'Compat',
      author: 'Test',
      description: 'Demo',
      capabilities: ['skills'],
      entryPoints: { skills: 'skills/' },
      minCarinaVersion: running,
    });

    const result = await validateExtensionBundle(dir, { allowHighRisk: true });
    expect(result.ok).toBe(true);
  });
});
