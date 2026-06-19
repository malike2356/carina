import express from 'express';
import session from 'express-session';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'http';

describe('workspace-presets-api', () => {
  let tmpHome: string;
  let server: Server | undefined;
  const prevHome = process.env.CARINA_HOME;

  beforeEach(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-presets-'));
    process.env.CARINA_HOME = tmpHome;
    vi.resetModules();
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = undefined;
    }
    if (prevHome === undefined) delete process.env.CARINA_HOME;
    else process.env.CARINA_HOME = prevHome;
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  async function mount(authed: boolean): Promise<number> {
    const { workspacePresetsApiRouter } = await import('./workspace-presets-api.js');
    const app = express();
    app.use(express.json());
    app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: true }));
    if (authed) {
      app.use((req, _res, next) => {
        req.session.webAuthed = true;
        next();
      });
    }
    app.use('/api/workspace/presets', workspacePresetsApiRouter);
    return new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server!.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        resolve(port);
      });
    });
  }

  it('requires auth', async () => {
    const port = await mount(false);
    const res = await fetch(`http://127.0.0.1:${port}/api/workspace/presets`);
    expect(res.status).toBe(401);
  });

  it('creates, lists, and deletes presets', async () => {
    const port = await mount(true);
    const base = `http://127.0.0.1:${port}/api/workspace/presets`;

    const create = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Morning research',
        sessionId: 'sess-1',
        preview: 'Compare providers',
        provider: 'anthropic',
        theme: 'dark',
      }),
    });
    expect(create.status).toBe(201);
    const created = await create.json() as { id: string; name: string };
    expect(created.name).toBe('Morning research');

    const list = await fetch(base).then((r) => r.json()) as { presets: Array<{ id: string }> };
    expect(list.presets.some((p) => p.id === created.id)).toBe(true);

    const del = await fetch(`${base}/${created.id}`, { method: 'DELETE' });
    expect(del.status).toBe(204);

    const after = await fetch(base).then((r) => r.json()) as { presets: unknown[] };
    expect(after.presets.length).toBe(0);
  });
});
