import express from 'express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'http';
import { mountLocaleRoutes } from './locale-api.js';
import { _resetI18nCacheForTests } from '../i18n/index.js';

describe('locale-api', () => {
  let server: Server;
  let port: number;

  beforeEach(async () => {
    _resetI18nCacheForTests();
    const app = express();
    app.use(express.json());
    mountLocaleRoutes(app);
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        port = typeof addr === 'object' && addr ? addr.port : 0;
        resolve();
      });
    });
  });

  afterEach(async () => {
    _resetI18nCacheForTests();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('returns Spanish login strings when lang=es', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/locale?lang=es&prefix=web.login`);
    expect(res.status).toBe(200);
    const body = await res.json() as { locale: string; strings: Record<string, string> };
    expect(body.locale).toBe('es');
    expect(body.strings['web.login.submit']).toBe('Iniciar sesion');
  });

  it('falls back to English keys for missing translations', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/locale?lang=es&prefix=web.login`);
    const body = await res.json() as { strings: Record<string, string> };
    expect(body.strings['web.login.title']).toBe('Carina');
  });
});
