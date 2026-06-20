import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';
import { Router } from 'express';
import {
  SCOUT_BASE,
  SCOUT_CONSOLE_BASE,
  SCOUT_DASHBOARD_API,
  scoutGet,
  scoutHeaders,
} from '../lib/scout.js';

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

function scoutDashboardInjection(): string {
  const accountId = process.env.SCOUT_OPERATOR_ACCOUNT_ID?.trim() ?? '';
  const accountJs = accountId ? JSON.stringify(accountId) : 'null';
  return [
    '<script>',
    'window.__SCOUT_KEY = \'\';',
    'window.__SCOUT_API_BASE = \'/scout-api\';',
    'window.__SCOUT_ACCOUNT_ID = ' + accountJs + ';',
    '(function(){',
    '  const prefix = window.__SCOUT_API_BASE;',
    '  if (!prefix) return;',
    '  const rewrite = function(url) {',
    '    if (typeof url !== \'string\' || !url.startsWith(\'/api/\')) return url;',
    '    var next = prefix + url;',
    '    if (window.__SCOUT_ACCOUNT_ID && next.indexOf(\'account_id=\') === -1) {',
    '      next += (next.indexOf(\'?\') >= 0 ? \'&\' : \'?\') + \'account_id=\' + encodeURIComponent(window.__SCOUT_ACCOUNT_ID);',
    '    }',
    '    return next;',
    '  };',
    '  const orig = window.fetch.bind(window);',
    '  window.fetch = function(url, init) { return orig(rewrite(url), init); };',
    '  if (window.EventSource) {',
    '    const OrigES = window.EventSource;',
    '    window.EventSource = function(url, opts) { return new OrigES(rewrite(url), opts); };',
    '  }',
    '})();',
    '</script>',
  ].join('');
}

function appendOperatorAccountId(url: string): string {
  const accountId = process.env.SCOUT_OPERATOR_ACCOUNT_ID?.trim();
  if (!accountId || url.includes('account_id=')) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}account_id=${encodeURIComponent(accountId)}`;
}

function serveConsoleDashboard(res: import('express').Response): void {
  try {
    const consolePublic = resolveConsolePublicDir();
    const htmlPath = path.join(consolePublic, 'dashboard.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    html = html.replace('<!-- __SCOUT_KEY_INJECTION__ -->', scoutDashboardInjection());
    res.type('html').send(html);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ops] Scout console serve failed:', msg);
    res.status(500).render('error', { message: 'Scout console unavailable: ' + msg });
  }
}

async function renderScoutSummary(res: import('express').Response): Promise<void> {
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
    title: 'Scout Summary',
    scoutOnline: Boolean(data),
    scoutUrl,
    scoutConsoleUrl,
    stats: data?.stats ?? emptyStats(),
    instances,
    activeCount,
    score,
    scoreLabel: scoreLabel(score),
  });
}

scoutDashboardRouter.get('/', (_req, res) => {
  serveConsoleDashboard(res);
});

scoutDashboardRouter.get('/console', (_req, res) => {
  serveConsoleDashboard(res);
});

scoutDashboardRouter.get('/summary', (req, res) => {
  void renderScoutSummary(res);
});

async function proxyToScout(req: import('express').Request, res: import('express').Response): Promise<void> {
  const suffix = req.url.startsWith('/') ? req.url : `/${req.url}`;
  const targetUrl = appendOperatorAccountId(`${SCOUT_DASHBOARD_API}${suffix}`);
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

  const abort = new AbortController();
  req.on('close', () => abort.abort());

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      signal: abort.signal,
    });

    res.status(upstream.status);
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    const cacheControl = upstream.headers.get('cache-control');
    if (cacheControl) res.setHeader('Cache-Control', cacheControl);

    const isEventStream = contentType?.includes('text/event-stream') ?? false;
    if (isEventStream && upstream.body) {
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();
      Readable.fromWeb(upstream.body as import('stream/web').ReadableStream).pipe(res);
      return;
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (err) {
    if (abort.signal.aborted) return;
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ops] Scout dashboard API proxy failed:', msg);
    res.status(502).json({ error: 'Scout dashboard API unreachable', detail: msg });
  }
}

export const scoutApiProxyRouter = Router();
scoutApiProxyRouter.all('/*', (req, res) => {
  void proxyToScout(req, res);
});
