import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Router } from 'express';
import { SCOUT_BASE, SCOUT_CONSOLE_BASE, scoutGet, scoutHeaders } from '../lib/scout.js';

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

interface ScoutStats {
  critical: number;
  warning: number;
  info: number;
  breach: number;
}

interface ScoutInstance {
  id: string;
  name: string;
  status: string;
  last_heartbeat: string | null;
  secondsAgo?: number | null;
}

interface StatusPayload {
  instances?: ScoutInstance[];
  stats?: ScoutStats;
}

function emptyStats(): ScoutStats {
  return { critical: 0, warning: 0, info: 0, breach: 0 };
}

function scoreLabel(score: number | null): string {
  if (score == null) return 'Loading...';
  if (score >= 80) return 'Healthy';
  if (score >= 60) return 'Fair';
  if (score > 0) return 'Needs attention';
  return 'No data';
}

scoutDashboardRouter.get('/', async (_req, res) => {
  const scoutUrl = SCOUT_BASE;
  const scoutConsoleUrl = SCOUT_CONSOLE_BASE;
  const data = (await scoutGet('/api/admin/status')) as StatusPayload | null;
  let score: number | null = null;

  if (data) {
    const scoreData = (await scoutGet('/api/score')) as { score?: number; overall?: number; value?: number } | null;
    score = scoreData?.score ?? scoreData?.overall ?? scoreData?.value ?? null;
  }

  const instances = data?.instances ?? [];
  const activeCount = instances.filter((i) => i.status === 'active').length;

  res.render('scout/index', {
    title: 'Scout Dashboard',
    scoutOnline: Boolean(data),
    scoutUrl,
    scoutConsoleUrl,
    stats: data?.stats ?? emptyStats(),
    instances,
    activeCount,
    score,
    scoreLabel: scoreLabel(score),
  });
});

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

scoutDashboardRouter.get('/console', (_req, res) => {
  try {
    const consolePublic = resolveConsolePublicDir();
    const htmlPath = path.join(consolePublic, 'dashboard.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    html = html.replace('<!-- __SCOUT_KEY_INJECTION__ -->', scoutDashboardInjection());
    res.type('html').send(html);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ops] Scout legacy console serve failed:', msg);
    res.status(500).render('error', { message: 'Scout console unavailable: ' + msg });
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
