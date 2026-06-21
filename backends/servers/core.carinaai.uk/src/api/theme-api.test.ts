import express from 'express';
import { describe, expect, it, vi, beforeEach } from 'vitest';

describe('theme-api', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('creates and lists themes', async () => {
    const { themeApiRouter } = await import('./theme-api.js');
    const app = express();
    app.use(express.json());
    app.use('/api/theme', themeApiRouter);

    await new Promise<void>((resolve) => {
      const server = app.listen(0, async () => {
        const port = (server.address() as { port: number }).port;
        const base = `http://127.0.0.1:${port}/api/theme`;

        const create = await fetch(base, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'deep ocean', bg: '#040d1a', accent: '#00d4ff' }),
        });
        expect(create.status).toBe(200);

        const list = await fetch(base).then((r) => r.json()) as { themes: Array<{ name: string }> };
        expect(list.themes.some((t) => t.name === 'deep ocean')).toBe(true);

        const del = await fetch(`${base}/deep%20ocean`, { method: 'DELETE' });
        expect(del.status).toBe(200);

        server.close(() => resolve());
      });
    });
  });
});

describe('themeTool', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('lists theme names via API', async () => {
    vi.doMock('../config/index.js', () => ({
      config: { web: { port: 3999 }, server: { port: 3999 } },
    }));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ themes: [{ name: 'deep ocean' }] }),
      }),
    );

    const { themeTool } = await import('../tools/theme.js');
    const result = await themeTool.execute({ action: 'list' });
    expect(result).toBe('deep ocean');
  });
});
