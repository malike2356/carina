import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const tmpHome = path.join(os.tmpdir(), `carina-op-packs-${Date.now()}`);

vi.mock('../memory/db.js', () => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock('../config/index.js', () => ({
  config: {
    carina: {
      activePacks: ['property-uk'],
    },
  },
}));

vi.mock('../config/paths.js', () => ({
  resolveCarinaHome: () => tmpHome,
  CARINA_HOME: tmpHome,
}));

vi.mock('./index.js', () => ({
  enablePackRuntime: vi.fn(async () => 0),
}));

describe('operator-pack-store', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await fs.rm(tmpHome, { recursive: true, force: true });
    vi.resetModules();
  });

  afterEach(async () => {
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it('seeds env packs into the store once, then serves GUI-managed state', async () => {
    const { pool } = await import('../memory/db.js');
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    vi.mocked(pool.query).mockResolvedValue({ rows: [], rowCount: 0 } as never);

    const store = await import('./operator-pack-store.js');
    await store.initOperatorPackStore({ fileOnly: true });
    expect(store.getOperatorActivePacks()).toEqual(['property-uk']);

    await store.installOperatorPack('finance', '1.0.0');
    expect(store.getOperatorActivePacks()).toEqual(['property-uk', 'finance']);

    await store.uninstallOperatorPack('property-uk');
    expect(store.getOperatorActivePacks()).toEqual(['finance']);
  });

  it('persists operator installs to the database when available', async () => {
    const { pool } = await import('../memory/db.js');
    vi.mocked(pool.query).mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT pack_name') && sql.includes('installed_packs')) {
        return {
          rows: [{
            pack_name: 'finance',
            version: '1.0.0',
            installed_at: new Date(),
            status: 'installed',
            updated_at: new Date(),
            updated_by: 'operator',
          }],
          rowCount: 1,
        } as never;
      }
      return { rows: [], rowCount: 0 } as never;
    });

    const store = await import('./operator-pack-store.js');
    await store.initOperatorPackStore();
    await store.installOperatorPack('finance', '1.0.0');
    const installed = await store.listOperatorInstalledPacks();
    expect(installed.some((row) => row.pack_name === 'finance')).toBe(true);
  });

  it('syncs active packs in bulk and records audit metadata', async () => {
    const store = await import('./operator-pack-store.js');
    await store.initOperatorPackStore({ fileOnly: true });
    store.setOperatorActivePacks(['property-uk']);

    const result = await store.syncOperatorActivePacks(['finance'], {
      actor: 'ops-admin',
      source: 'test',
      versions: { finance: '1.0.0' },
    });
    expect(result.active).toEqual(['finance']);
    expect(result.added).toEqual(['finance']);
    expect(result.removed).toEqual(['property-uk']);
    expect(store.getOperatorActivePacks()).toEqual(['finance']);

    const last = await store.getLastOperatorPackAudit();
    expect(last?.actor).toBe('ops-admin');
    expect(last?.packs_before).toEqual(['property-uk']);
    expect(last?.packs_after).toEqual(['finance']);
  });

  it('falls back to env packs when store is empty on init', async () => {
    const store = await import('./operator-pack-store.js');
    await store.initOperatorPackStore({ fileOnly: true });
    expect(store.getOperatorActivePacks()).toEqual(['property-uk']);
  });

  it('records audit metadata when installing and uninstalling single packs', async () => {
    const store = await import('./operator-pack-store.js');
    await store.initOperatorPackStore({ fileOnly: true });
    store.setOperatorActivePacks([]);

    await store.installOperatorPack('finance', '1.0.0', { actor: 'web-operator', source: 'packs-ui' });
    let last = await store.getLastOperatorPackAudit();
    expect(last?.actor).toBe('web-operator');
    expect(last?.packs_before).toEqual([]);
    expect(last?.packs_after).toEqual(['finance']);

    await store.uninstallOperatorPack('finance', { actor: 'web-operator', source: 'packs-ui' });
    last = await store.getLastOperatorPackAudit();
    expect(last?.packs_before).toEqual(['finance']);
    expect(last?.packs_after).toEqual([]);
  });
});
