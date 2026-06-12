import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

const { tmpHome } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodePath = require('node:path') as typeof import('path');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeOs = require('node:os') as typeof import('os');
  return { tmpHome: nodePath.join(nodeOs.tmpdir(), `carina-ext-store-${process.pid}`) };
});

vi.mock('../config/paths.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config/paths.js')>();
  return {
    ...actual,
    CARINA_HOME: tmpHome,
  };
});

describe('extension store', () => {
  beforeEach(async () => {
    vi.resetModules();
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  afterEach(async () => {
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it('persists install and enable state', async () => {
    const { upsertExtensionRecord, readExtensionStore, listEnabledExtensionIds } = await import('./store.js');
    const manifest = {
      manifestVersion: 1,
      id: 'demo-store',
      version: '0.0.1',
      name: 'Demo',
      author: 'Test',
      description: 'Store test',
      capabilities: ['skills'],
      entryPoints: { skills: 'skills/' },
      risk: 'low',
    } as import('./manifest.js').ExtensionManifest;

    await upsertExtensionRecord(manifest, { status: 'installed' });
    await upsertExtensionRecord(manifest, {
      status: 'enabled',
      enabled_at: new Date().toISOString(),
    });

    const rows = await readExtensionStore();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('enabled');
    expect(await listEnabledExtensionIds()).toEqual(['demo-store']);
  });
});
