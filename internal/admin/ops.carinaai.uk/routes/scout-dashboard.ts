import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Router } from 'express';
import { SCOUT_BASE, scoutHeaders } from '../lib/scout.js';

export const scoutDashboardRouter = Router();

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));
const __opsDir = path.basename(__moduleDir) === 'dist'
  ? path.dirname(__moduleDir)
  : path.resolve(__moduleDir, '..');

export function resolveConsolePublicDir(): string {
  const candidates = [
    process.env.SCOUT_CONSOLE_PUBLIC_DIR,
    path.resolve(__opsDir, '..', 'servers', 'console.labyrinthscout.com', 'public'),
    path.resolve(__opsDir, '..', 'console.labyrinthscout.com', 'public'),
    '/home/malike/apps/console.labyrinthscout.com/public',
  ].filter(Boolean) as string[];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'dashboard.html'))) return dir;
  }
  return candidates[0] ?? path.join(__opsDir, 'public');
}

function scoutDashboardInjection(): string {
  return [
    '<script>',
    'window.__SCOUT_KEY = \'\';',
    'window.__SCOUT_API_BASE = \'/scout-api\';',
    '(function(){',
    '  const prefix = window.__SCOUT_API_BASE;',
    '  if (!prefix) return;',
    '  const orig = window.fetch.bind(window);',
    '  window.fetch = function(url, init) {',
    '    if (typeof url === \'string\' && url.startsWith(\'/api/\')) {',
    '      url = prefix + url;',
    '    }',
    '    return orig(url, init);',
    '  };',
    '})();',
    '</script>',
  ].join('');
}

scoutDashboardRouter.get('/', (_req, res) => {
  try {
    const consolePublic = resolveConsolePublicDir();
    const htmlPath = path.join(consolePublic, 'dashboard.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    html = html.replace('<!-- __SCOUT_KEY_INJECTION__ -->', scoutDashboardInjection());
    res.type('html').send(html);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ops] Scout dashboard serve failed:', msg);
    res.status(500).render('error', { message: 'Scout dashboard unavailable: ' + msg });
  }
});

async function proxyToScout(req: import('express').Request, res: import('express').Response): Promise<void> {
  const suffix = req.url.startsWith('/') ? req.url : `/${req.url}`;
  const targetUrl = `${SCOUT_BASE}${suffix}`;
  const headers = new Headers(scoutHeaders());
  const incoming = req.headers['content-type'];
  if (incoming) headers.set('Content-Type', String(incoming));

  let body: string | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = typeof req.body === 'string'
      ? req.body
      : req.body && Object.keys(req.body).length > 0
        ? JSON.stringify(req.body)
        : undefined;
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      signal: AbortSignal.timeout(60_000),
    });

    res.status(upstream.status);
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    const cacheControl = upstream.headers.get('cache-control');
    if (cacheControl) res.setHeader('Cache-Control', cacheControl);

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ops] Scout API proxy failed:', msg);
    res.status(502).json({ error: 'Scout API unreachable', detail: msg });
  }
}

export const scoutApiProxyRouter = Router();
scoutApiProxyRouter.all('/*', (req, res) => {
  void proxyToScout(req, res);
});
