import express from 'express';
import session from 'express-session';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'http';
import { guiInstalledPayload } from './packs-api.helpers.js';

const tmpHome = path.join(os.tmpdir(), `carina-packs-api-${Date.now()}`);

vi.mock('../memory/db.js', () => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock('../config/paths.js', () => ({
  CARINA_HOME: tmpHome,
  resolveCarinaHome: () => tmpHome,
}));

vi.mock('../config/index.js', () => ({
  config: {
    carina: {
      activePacks: [],
    },
  },
}));

vi.mock('../skills/user-resources.js', () => ({
  deleteCustomResource: vi.fn(),
  listCustomResources: vi.fn(async () => []),
  loadAllUserResources: vi.fn(async () => ({ skillsLoaded: 0, chunksIngested: 0 })),
  saveCustomResource: vi.fn(),
}));

vi.mock('../skills/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../skills/index.js')>();
  return {
    ...actual,
    enablePackRuntime: vi.fn(async () => 0),
  };
});

async function mountPacksRouter(authed: boolean): Promise<{ server: Server; port: number }> {
  vi.resetModules();
  const { pool } = await import('../memory/db.js');
  vi.mocked(pool.query).mockResolvedValue({ rows: [], rowCount: 0 } as never);

  const store = await import('../skills/operator-pack-store.js');
  await store.initOperatorPackStore({ fileOnly: true });
  store.setOperatorActivePacks([]);

  const { packsApiRouter } = await import('./packs-api.js');
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: true }));
  if (authed) {
    app.use((req, _res, next) => {
      req.session.webAuthed = true;
      next();
    });
  }
  app.use('/api/packs', packsApiRouter);

  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ server, port });
    });
  });
}

describe('packs-api gui mode', () => {
  it('returns gui management metadata for operator installs', () => {
    const body = guiInstalledPayload([
      {
        pack_name: 'finance',
        version: '1.0.0',
        installed_at: '2026-01-01T00:00:00.000Z',
        status: 'installed',
        updated_by: 'web-operator',
      },
    ]);
    expect(body.management).toBe('gui');
    expect(body.operatorHint).toContain('without editing .env');
    expect(body.installed[0]?.pack_name).toBe('finance');
  });
});

describe('packs-api routes', () => {
  let server: Server | undefined;
  let port = 0;

  beforeEach(async () => {
    vi.clearAllMocks();
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = undefined;
    }
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it('rejects unauthenticated pack reads', async () => {
    ({ server, port } = await mountPacksRouter(false));
    const res = await fetch(`http://127.0.0.1:${port}/api/packs/available`);
    expect(res.status).toBe(401);
  });

  it('lists available packs for authenticated operator sessions', async () => {
    ({ server, port } = await mountPacksRouter(true));
    const res = await fetch(`http://127.0.0.1:${port}/api/packs/available`);
    expect(res.status).toBe(200);
    const body = await res.json() as { packs: Array<{ name: string }> };
    expect(body.packs.some((pack) => pack.name === 'finance')).toBe(true);
  });

  it('saves operator active packs and returns audit metadata', async () => {
    ({ server, port } = await mountPacksRouter(true));
    const res = await fetch(`http://127.0.0.1:${port}/api/packs/active`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ packs: ['finance'] }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; active: string[]; lastChange: { actor: string } | null };
    expect(body.ok).toBe(true);
    expect(body.active).toEqual(['finance']);
    expect(body.lastChange?.actor).toBe('web-operator');

    const activeRes = await fetch(`http://127.0.0.1:${port}/api/packs/active`);
    expect(activeRes.status).toBe(200);
    const activeBody = await activeRes.json() as { active: string[]; source: string };
    expect(activeBody.active).toEqual(['finance']);
    expect(activeBody.source).toBe('persisted');
  });

  it('rejects unknown packs on bulk save', async () => {
    ({ server, port } = await mountPacksRouter(true));
    const res = await fetch(`http://127.0.0.1:${port}/api/packs/active`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ packs: ['not-a-real-pack'] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { invalid: string[] };
    expect(body.invalid).toEqual(['not-a-real-pack']);
  });

  it('installs a pack from the packs UI and persists operator state', async () => {
    ({ server, port } = await mountPacksRouter(true));
    const res = await fetch(`http://127.0.0.1:${port}/api/packs/finance/install`, {
      method: 'POST',
    });
    expect(res.status).toBe(200);

    const installedRes = await fetch(`http://127.0.0.1:${port}/api/packs/installed`);
    const installedBody = await installedRes.json() as { installed: Array<{ pack_name: string }> };
    expect(installedBody.installed.some((row) => row.pack_name === 'finance')).toBe(true);
  });

  it('falls back to env packs when operator store is empty on read', async () => {
    vi.doMock('../config/index.js', () => ({
      config: {
        carina: {
          activePacks: ['property-uk'],
        },
      },
    }));
    ({ server, port } = await mountPacksRouter(true));
    const store = await import('../skills/operator-pack-store.js');
    store.setOperatorActivePacks(['property-uk']);

    const res = await fetch(`http://127.0.0.1:${port}/api/packs/installed`);
    expect(res.status).toBe(200);
    const body = await res.json() as { installed: Array<{ pack_name: string }>; management: string };
    expect(body.management).toBe('gui');
    expect(body.installed.some((row) => row.pack_name === 'property-uk')).toBe(true);
  });
});
